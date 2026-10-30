import type { Request, Response } from "express";
import { User, type IUser, type UserRole } from "../models/User.js";
import { generateToken } from "../middleware/auth.js";
import { Task } from "../models/Task.js";
import { env } from "../config/env.js";
import { normalizePhone } from "../utils/phone.js";
import { notify } from "../utils/notify.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_IMAGE_CHARS = 2_000_000; // ~1.5MB of image data per field

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isImageValue(img: unknown): img is string {
  return (
    typeof img === "string" &&
    img.length <= MAX_IMAGE_CHARS &&
    (img.startsWith("data:image/") || /^https?:\/\//i.test(img))
  );
}

/** Private payload for the signed-in user (never includes the password hash). */
export function privateUserPayload(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    location: user.location || "",
    avatar: user.avatar || "",
    portfolioImages: user.portfolioImages || [],
    about: user.about || "",
    skills: user.skills || [],
    education: user.education || "",
    certificates: user.certificates || "",
    portfolioLink: user.portfolioLink || "",
    workingDays: user.workingDays || [],
    startTime: user.startTime || "09:00",
    endTime: user.endTime || "17:00",
    travelRadius: user.travelRadius ?? 10,
    phoneVerified: !!user.phoneVerified,
    kycStatus: user.kycStatus || "none",
    kycAadhaarMasked: user.kycAadhaarLast4 ? `XXXX XXXX ${user.kycAadhaarLast4}` : "",
    kycRejectionReason: user.kycRejectionReason || "",
    // Whether this user must pass identity verification to apply for tasks.
    kycRequired: env.kyc.required && (user.role === "tasker" || user.role === "both"),
    kycMode: env.kyc.provider,
    rating: user.rating,
  };
}

export async function register(req: Request, res: Response) {
  const name = str(req.body?.name)?.trim();
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required." });
    return;
  }
  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: "Name must be between 2 and 80 characters." });
    return;
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (password.length < 6 || password.length > 128) {
    res.status(400).json({ error: "Password must be between 6 and 128 characters." });
    return;
  }

  const phone = normalizePhone(str(req.body?.phone) ?? "");
  if (!phone) {
    res.status(400).json({ error: "Enter a valid mobile number." });
    return;
  }
  if (await User.exists({ phone, phoneVerified: true })) {
    res.status(409).json({ error: "This mobile number is already registered." });
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  const newUser = new User({ name, email, password, phone, role: null, rating: 5.0 });
  try {
    await newUser.save();
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }
    throw err;
  }

  await notify(
    newUser._id,
    "system",
    "Welcome to Questly!",
    "Complete your profile in Settings to get started.",
    "/settings",
  );

  res.status(201).json({
    user: privateUserPayload(newUser),
    token: generateToken(String(newUser._id)),
  });
}

export async function login(req: Request, res: Response) {
  const email = str(req.body?.email)?.trim().toLowerCase();
  const password = str(req.body?.password);

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = await User.findOne({ email });
  // Same response for unknown email and wrong password (no account enumeration).
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  res.json({
    user: privateUserPayload(user),
    token: generateToken(String(user._id)),
  });
}

export async function getMe(req: Request, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({ user: privateUserPayload(user) });
}

export async function updateMe(req: Request, res: Response) {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const { name, phone, location, role, avatar, portfolioImages } = req.body ?? {};

  if (name !== undefined) {
    const v = str(name)?.trim();
    if (!v || v.length < 2 || v.length > 80) {
      res.status(400).json({ error: "Name must be between 2 and 80 characters." });
      return;
    }
    user.name = v;
  }
  if (phone !== undefined) {
    const raw = str(phone)?.trim();
    if (raw === undefined || raw === null) {
      res.status(400).json({ error: "Phone number must be text." });
      return;
    }
    // Changing the number always un-verifies it; the user must confirm the new one by OTP.
    const next = raw === "" ? "" : normalizePhone(raw);
    if (next === null) {
      res.status(400).json({ error: "Enter a valid mobile number." });
      return;
    }
    if (next !== user.phone) {
      if (next && (await User.exists({ phone: next, phoneVerified: true, _id: { $ne: user._id } }))) {
        res.status(409).json({ error: "This mobile number is already used by another account." });
        return;
      }
      user.phone = next;
      user.phoneVerified = false;
      user.phoneVerifiedAt = undefined;
    }
  }
  if (location !== undefined) {
    const v = str(location)?.trim();
    if (v === undefined || v === null || v.length > 200) {
      res.status(400).json({ error: "Location is too long." });
      return;
    }
    user.location = v;
  }
  if (avatar !== undefined) {
    if (avatar !== "" && !isImageValue(avatar)) {
      res.status(400).json({ error: "Avatar must be an image (up to ~1.5MB) or http(s) URL." });
      return;
    }
    user.avatar = avatar;
  }

  // Up to 5 image data URLs or http(s) URLs.
  if (portfolioImages !== undefined) {
    if (
      !Array.isArray(portfolioImages) ||
      portfolioImages.length > 5 ||
      !portfolioImages.every(isImageValue)
    ) {
      res.status(400).json({
        error: "portfolioImages must be an array of up to 5 image data URLs or http(s) URLs.",
      });
      return;
    }
    user.portfolioImages = portfolioImages;
  }

  const taskerError = applyTaskerFields(user, req.body ?? {});
  if (taskerError) {
    res.status(400).json({ error: taskerError });
    return;
  }

  if (role !== undefined) {
    if (!["customer", "tasker", "both", null].includes(role)) {
      res.status(400).json({ error: "Invalid role." });
      return;
    }
    const blocked = await roleChangeBlocker(String(user._id), role);
    if (blocked) {
      res.status(409).json({ error: blocked });
      return;
    }
    user.role = role;
  }

  await user.save();
  res.json({ user: privateUserPayload(user) });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function textField(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim().length <= max ? v.trim() : null;
}

/** Validates and applies the optional tasker-profile fields. Returns an error message or null. */
function applyTaskerFields(user: IUser, body: Record<string, unknown>): string | null {
  const textSpecs: ["about" | "education" | "certificates", number, string][] = [
    ["about", 1000, "About"],
    ["education", 200, "Education"],
    ["certificates", 300, "Certificates"],
  ];
  for (const [key, max, label] of textSpecs) {
    if (body[key] === undefined) continue;
    const v = textField(body[key], max);
    if (v === null) return `${label} must be text of at most ${max} characters.`;
    user[key] = v;
  }

  if (body.portfolioLink !== undefined) {
    const v = textField(body.portfolioLink, 300);
    if (v === null || (v !== "" && !/^https?:\/\//i.test(v))) {
      return "Portfolio link must be an http(s) URL.";
    }
    user.portfolioLink = v;
  }

  if (body.skills !== undefined) {
    const skills = body.skills;
    if (
      !Array.isArray(skills) ||
      skills.length > 20 ||
      !skills.every((s) => typeof s === "string" && s.trim().length > 0 && s.length <= 40)
    ) {
      return "Skills must be a list of up to 20 short names.";
    }
    user.skills = [...new Set(skills.map((s: string) => s.trim()))];
  }

  if (body.workingDays !== undefined) {
    const days = body.workingDays;
    if (!Array.isArray(days) || !days.every((d) => WEEKDAYS.includes(d))) {
      return "Working days must be weekday abbreviations (Mon-Sun).";
    }
    user.workingDays = [...new Set(days as string[])];
  }

  for (const key of ["startTime", "endTime"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !TIME_RE.test(body[key] as string)) {
      return `${key} must be in HH:MM format.`;
    }
    user[key] = body[key] as string;
  }

  if (body.travelRadius !== undefined) {
    const n = Number(body.travelRadius);
    if (!Number.isFinite(n) || n < 1 || n > 500) return "Travel radius must be between 1 and 500.";
    user.travelRadius = Math.round(n);
  }
  return null;
}

/**
 * Stops a role change that would strand live work, e.g. dropping the tasker role
 * while assigned to a task, or dropping the customer role with open posted tasks.
 */
async function roleChangeBlocker(userId: string, role: UserRole): Promise<string | null> {
  const canWork = role === "tasker" || role === "both";
  const canPost = role === "customer" || role === "both";

  if (!canWork) {
    const active = await Task.exists({ workerId: userId, status: "in_progress" });
    if (active) return "Finish the tasks you are assigned to before giving up the tasker role.";
  }
  if (!canPost) {
    const active = await Task.exists({ posterId: userId, status: { $in: ["open", "in_progress"] } });
    if (active) return "Finish or delete your active posted tasks before giving up the customer role.";
  }
  return null;
}

export async function changePassword(req: Request, res: Response) {
  const current = str(req.body?.currentPassword);
  const next = str(req.body?.newPassword);
  if (!current || !next) {
    res.status(400).json({ error: "Current and new password are required." });
    return;
  }
  if (next.length < 6 || next.length > 128) {
    res.status(400).json({ error: "New password must be between 6 and 128 characters." });
    return;
  }
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (!(await user.comparePassword(current))) {
    res.status(401).json({ error: "Your current password is incorrect." });
    return;
  }
  if (current === next) {
    res.status(400).json({ error: "Choose a password different from the current one." });
    return;
  }
  user.password = next;
  await user.save();
  res.json({ success: true });
}
