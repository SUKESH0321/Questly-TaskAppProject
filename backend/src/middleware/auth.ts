import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User.js";
import { env } from "../config/env.js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      authUser?: IUser;
    }
  }
}

const JWT_SECRET = env.jwtSecret;

/**
 * Auth middleware that verifies a JWT Bearer token.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Provide a Bearer token." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: "Invalid user." });
      return;
    }
    req.userId = decoded.userId;
    req.authUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

/** Blocks actions until the user's mobile number is verified. Use after authMiddleware. */
export function requirePhoneVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser?.phoneVerified) {
    res.status(403).json({ error: "Verify your mobile number to continue.", code: "PHONE_NOT_VERIFIED" });
    return;
  }
  next();
}

/** Only the company admin account may continue. Use after authMiddleware. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.authUser?.role !== "admin") {
    res.status(403).json({ error: "Admin access only." });
    return;
  }
  next();
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}