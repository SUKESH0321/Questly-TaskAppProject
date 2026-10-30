import type { Request, Response } from "express";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { User } from "../models/User.js";
import { PhoneOtp } from "../models/PhoneOtp.js";
import { env } from "../config/env.js";
import { normalizePhone, maskPhone } from "../utils/phone.js";
import { sendOtpSms } from "../utils/sms.js";
import { getKycProvider } from "../utils/kyc.js";
import { privateUserPayload } from "./auth.js";

const OTP_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, phone: string, code: string): string {
  return createHmac("sha256", env.jwtSecret).update(`${userId}:${phone}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Sends a 6-digit code to the user's number (or to a new number passed as `phone`). */
export async function sendPhoneOtp(req: Request, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  // Optionally change the number first (always un-verifies it).
  if (req.body?.phone !== undefined) {
    const next = typeof req.body.phone === "string" ? normalizePhone(req.body.phone) : null;
    if (!next) {
      res.status(400).json({ error: "Enter a valid mobile number." });
      return;
    }
    if (next !== user.phone) {
      const taken = await User.exists({ phone: next, phoneVerified: true, _id: { $ne: user._id } });
      if (taken) {
        res.status(409).json({ error: "This mobile number is already used by another account." });
        return;
      }
      user.phone = next;
      user.phoneVerified = false;
      user.phoneVerifiedAt = undefined;
      await user.save();
    }
  }

  const phone = user.phone ? normalizePhone(user.phone) : null;
  if (!phone) {
    res.status(400).json({ error: "Add a mobile number first." });
    return;
  }
  if (user.phoneVerified) {
    res.status(400).json({ error: "This number is already verified." });
    return;
  }

  // Abuse limits: 30s between sends, 5 per hour.
  const latest = await PhoneOtp.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
  if (latest) {
    const wait = RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime());
    if (wait > 0) {
      res.status(429).json({
        error: `Please wait ${Math.ceil(wait / 1000)}s before requesting another code.`,
        retryAfterSeconds: Math.ceil(wait / 1000),
      });
      return;
    }
  }
  const lastHour = await PhoneOtp.countDocuments({
    userId: user._id,
    createdAt: { $gte: new Date(Date.now() - 3_600_000) },
  });
  if (lastHour >= MAX_SENDS_PER_HOUR) {
    res.status(429).json({ error: "Too many codes requested. Try again in an hour." });
    return;
  }

  const code = String(randomInt(100000, 1000000));
  const otp = await PhoneOtp.create({
    userId: user._id,
    phone,
    codeHash: hashCode(String(user._id), phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  let devCode: string | undefined;
  try {
    ({ devCode } = await sendOtpSms(phone, code));
  } catch (err) {
    console.error("SMS send failed:", err);
    await otp.deleteOne();
    res.status(502).json({ error: "We couldn't send the SMS. Please try again in a moment." });
    return;
  }

  res.json({
    sent: true,
    phoneMasked: maskPhone(phone),
    retryAfterSeconds: RESEND_COOLDOWN_MS / 1000,
    expiresInSeconds: OTP_TTL_MS / 1000,
    // Only present in development with SMS_PROVIDER=console. Never in production.
    ...(devCode ? { devCode } : {}),
  });
}

export async function verifyPhoneOtp(req: Request, res: Response) {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter the 6-digit code." });
    return;
  }

  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (user.phoneVerified) {
    res.json({ user: privateUserPayload(user) });
    return;
  }

  const phone = user.phone ? normalizePhone(user.phone) : null;
  const otp = phone
    ? await PhoneOtp.findOne({ userId: user._id, phone, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 })
    : null;
  if (!otp) {
    res.status(400).json({ error: "That code has expired. Request a new one." });
    return;
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many wrong attempts. Request a new code." });
    return;
  }

  if (!safeEqual(otp.codeHash, hashCode(String(user._id), otp.phone, code))) {
    await PhoneOtp.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    res.status(400).json({
      error: left > 0 ? `Incorrect code. ${left} ${left === 1 ? "attempt" : "attempts"} left.` : "Too many wrong attempts. Request a new code.",
    });
    return;
  }

  user.phone = otp.phone;
  user.phoneVerified = true;
  user.phoneVerifiedAt = new Date();
  try {
    await user.save();
  } catch (err: any) {
    // Unique index: someone else verified this number between our check and now.
    if (err?.code === 11000) {
      res.status(409).json({ error: "This mobile number is already used by another account." });
      return;
    }
    throw err;
  }
  await PhoneOtp.deleteMany({ userId: user._id });

  res.json({ user: privateUserPayload(user) });
}

// ---------------- Identity (Aadhaar) verification ----------------

export function kycConfig(_req: Request, res: Response) {
  const provider = getKycProvider();
  res.json({ provider: provider.name, available: provider.available, required: env.kyc.required });
}

/** Starts identity verification for a tasker. Requires explicit consent. */
export async function kycStart(req: Request, res: Response) {
  const provider = getKycProvider();
  if (!provider.available) {
    res.status(503).json({ error: "Identity verification isn't available yet.", code: "KYC_UNAVAILABLE" });
    return;
  }
  if (req.body?.consent !== true) {
    res.status(400).json({ error: "Please agree to the identity verification consent to continue." });
    return;
  }

  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (user.role !== "tasker" && user.role !== "both") {
    res.status(403).json({ error: "Identity verification is for taskers. Switch your role in Settings first." });
    return;
  }
  if (!user.phoneVerified) {
    res.status(403).json({ error: "Verify your phone number first.", code: "PHONE_NOT_VERIFIED" });
    return;
  }
  if (user.kycStatus === "verified") {
    res.status(400).json({ error: "You're already verified." });
    return;
  }

  const { reference, redirectUrl } = await provider.start(user);
  user.kycStatus = "pending";
  user.kycProvider = provider.name;
  user.kycReference = reference;
  user.kycStartedAt = new Date();
  user.kycConsentAt = new Date();
  user.kycRejectionReason = "";
  await user.save();

  res.json({ status: user.kycStatus, redirectUrl, user: privateUserPayload(user) });
}

/** Checks the provider for the latest result of a pending verification. */
export async function kycStatus(req: Request, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (user.kycStatus === "pending") {
    const result = await getKycProvider().poll(user);
    if (result.status === "verified") {
      user.kycStatus = "verified";
      user.kycVerifiedAt = new Date();
      user.kycAadhaarLast4 = result.aadhaarLast4 ?? "";
      await user.save();
    } else if (result.status === "rejected") {
      user.kycStatus = "rejected";
      user.kycRejectionReason = result.reason ?? "We couldn't verify your identity.";
      await user.save();
    }
  }
  res.json({ status: user.kycStatus, user: privateUserPayload(user) });
}
