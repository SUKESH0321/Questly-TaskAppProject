import type { Request, Response } from "express";
import { Payment } from "../models/Payment.js";
import { COMMISSION_RATE } from "../utils/commission.js";

/**
 * Company figures for the admin account, and nothing else: how many tasks have been
 * completed (payment released) and how much the company has earned from them.
 */
export async function getAdminStats(_req: Request, res: Response) {
  const [row] = await Payment.aggregate<{ tasksCompleted: number; companyEarnings: number }>([
    { $match: { status: "released" } },
    {
      $group: {
        _id: null,
        tasksCompleted: { $sum: 1 },
        // Older payments (released before fees existed) get the same 10% computed on the fly.
        companyEarnings: { $sum: { $ifNull: ["$commission", { $round: [{ $multiply: ["$amount", COMMISSION_RATE] }, 2] }] } },
      },
    },
  ]);

  res.json({
    tasksCompleted: row?.tasksCompleted ?? 0,
    companyEarnings: Math.round((row?.companyEarnings ?? 0) * 100) / 100,
    commissionPercent: Math.round(COMMISSION_RATE * 100),
  });
}
