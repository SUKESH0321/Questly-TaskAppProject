import type mongoose from "mongoose";
import { Notification, type NotificationType } from "../models/Notification.js";

type Id = string | mongoose.Types.ObjectId;

/**
 * Creates an in-app notification. Never throws: a failed notification must not
 * break the action that triggered it.
 *
 * With `collapseUnread`, an existing unread notification with the same link is
 * updated instead of adding another (used for chat so 20 messages = 1 entry).
 */
export async function notify(
  userId: Id,
  type: NotificationType,
  title: string,
  description: string,
  link = "",
  options: { collapseUnread?: boolean } = {},
): Promise<void> {
  try {
    const text = description.slice(0, 300);
    if (options.collapseUnread && link) {
      // createdAt is immutable, so replace the old unread entry to bump it to the top.
      await Notification.deleteMany({ userId, type, link, read: false });
    }
    await Notification.create({ userId, type, title, description: text, link });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
