import { Task } from "../models/Task.js";
import { Application } from "../models/Application.js";
import { notify } from "./notify.js";

/** Search windows a poster may choose, in minutes. 0 means no timer. */
export const ALLOWED_SEARCH_MINUTES = [0, 15, 30, 60, 180, 1440];

/** Returns minutes, 0 when omitted, or null when the value isn't an allowed window. */
export function parseSearchMinutes(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return ALLOWED_SEARCH_MINUTES.includes(n) ? n : null;
}

/** Urgency tips (INR) a poster can add, and the search windows they apply to. */
export const ALLOWED_URGENCY_BONUS = [0, 10, 25, 50, 75];
export const URGENT_WINDOWS = [15, 30];

/** Returns the tip, 0 when omitted, or null when it isn't allowed. */
export function parseUrgencyBonus(value: unknown, searchMinutes: number): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!ALLOWED_URGENCY_BONUS.includes(n)) return null;
  if (n > 0 && !URGENT_WINDOWS.includes(searchMinutes)) return null;
  return n;
}

export function expiryFromMinutes(minutes: number): Date | null {
  return minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
}

/**
 * Ends the search window of open tasks whose timer ran out.
 *  - Nobody applied: the task becomes "expired" and the poster is told.
 *  - Applicants are waiting: the task stays open, the timer ends, and the poster
 *    is reminded to choose.
 * Each transition is a single conditional update, so running this on several
 * server instances at once can never notify twice.
 */
export async function expireDueTasks(): Promise<number> {
  const now = new Date();
  const due = await Task.find({ status: "open", expiresAt: { $ne: null, $lte: now } })
    .select("_id")
    .limit(200)
    .lean();

  let changed = 0;
  for (const { _id } of due) {
    const pending = await Application.countDocuments({ taskId: _id, status: "pending" });
    const guard = { _id, status: "open" as const, expiresAt: { $lte: now } };

    if (pending > 0) {
      const task = await Task.findOneAndUpdate(guard, { $set: { expiresAt: null } }, { new: true });
      if (task) {
        changed++;
        await notify(
          task.posterId,
          "application",
          "Taskers are waiting for you",
          `${pending} ${pending === 1 ? "tasker" : "taskers"} applied to "${task.title}". Pick one to get started.`,
          `/tasks/${task._id}`,
        );
      }
    } else {
      const task = await Task.findOneAndUpdate(
        guard,
        { $set: { status: "expired", expiredAt: new Date(), expiresAt: null } },
        { new: true },
      );
      if (task) {
        changed++;
        await notify(
          task.posterId,
          "status",
          "No one picked up your task",
          `Nobody applied to "${task.title}" in time. Repost it to keep searching.`,
          `/tasks/${task._id}`,
        );
      }
    }
  }
  return changed;
}
