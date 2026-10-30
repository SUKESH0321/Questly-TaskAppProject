import { env } from "../config/env.js";
import type { IUser } from "../models/User.js";

export type KycResult = {
  status: "pending" | "verified" | "rejected";
  /** Last 4 digits returned by the provider; the full number is never handled by us. */
  aadhaarLast4?: string;
  reason?: string;
};

export interface KycProvider {
  name: "none" | "sandbox";
  available: boolean;
  /** Begins a verification. A real provider returns a hosted page (DigiLocker) to redirect to. */
  start(user: IUser): Promise<{ reference: string; redirectUrl?: string }>;
  /** Looks up the current state of a verification. */
  poll(user: IUser): Promise<KycResult>;
}

/**
 * No provider connected. Identity verification is reported as unavailable and
 * NOTHING is ever marked verified.
 */
const noneProvider: KycProvider = {
  name: "none",
  available: false,
  async start() {
    throw new Error("No KYC provider configured");
  },
  async poll() {
    return { status: "pending" };
  },
};

/**
 * DEVELOPMENT ONLY. Simulates a provider so the UI flow can be tested: it reports
 * "verified" a few seconds after starting. It checks nothing and is refused in
 * production (see config/env.ts).
 */
const sandboxProvider: KycProvider = {
  name: "sandbox",
  available: true,
  async start(user) {
    return { reference: `sandbox_${user._id}_${Date.now()}` };
  },
  async poll(user) {
    const started = user.kycStartedAt?.getTime() ?? 0;
    if (Date.now() - started < 6000) return { status: "pending" };
    return { status: "verified", aadhaarLast4: "0000" };
  },
};

/*
 * To add a real provider (Digio, Signzy, Setu, IDfy, Surepass or DigiLocker):
 * implement KycProvider, have start() create the provider's KYC request and return
 * its hosted redirectUrl (the user enters Aadhaar/OTP on THEIR page, not ours), and
 * have poll() read the result with the stored kycReference. Then register it below.
 */
export function getKycProvider(): KycProvider {
  return env.kyc.provider === "sandbox" ? sandboxProvider : noneProvider;
}
