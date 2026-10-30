import type { Request, Response } from "express";
import { User } from "../models/User.js";
import { isValidId } from "../utils/http.js";
import { env } from "../config/env.js";

/**
 * Builds a safe, public-facing payload for a user.
 * Never exposes email, phone number or any other private field.
 */
function publicUserPayload(user: Record<string, any>) {
  return {
    id: user._id,
    name: user.name,
    role: user.role,
    location: user.location || "",
    avatar: user.avatar || "",
    portfolioImages: user.portfolioImages || [],
    about: user.about || "",
    skills: user.skills || [],
    education: user.education || "",
    certificates: user.certificates || "",
    portfolioLink: user.portfolioLink || "",
    workingDays: user.workingDays || [],
    startTime: user.startTime || "",
    endTime: user.endTime || "",
    travelRadius: user.travelRadius ?? null,
    // Badges only. Phone numbers and ID details are never public.
    phoneVerified: !!user.phoneVerified,
    kycVerified: user.kycStatus === "verified",
    // True when identity checks are simulated (demo), so the UI never overstates them.
    kycDemo: env.kyc.demo,
    rating: user.rating,
    createdAt: user.createdAt,
  };
}

export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid user id is required." });
    return;
  }

  const user = await User.findById(id).lean();
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({ user: publicUserPayload(user) });
}
