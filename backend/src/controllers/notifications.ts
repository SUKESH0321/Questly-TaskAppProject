import type { Request, Response } from "express";
import { Notification } from "../models/Notification.js";
import { isValidId } from "../utils/http.js";

export async function getNotifications(req: Request, res: Response) {
  const userNotifications = await Notification.find({ userId: req.userId! })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json({
    notifications: userNotifications.map((n) => ({ ...n, id: n._id.toString() })),
  });
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await Notification.countDocuments({ userId: req.userId!, read: false });
  res.json({ count });
}

export async function markAsRead(req: Request, res: Response) {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ error: "A valid notification id is required." });
    return;
  }
  // Scoped to the signed-in user, so other people's notifications look missing.
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId! },
    { $set: { read: true } },
    { new: true },
  ).lean();
  if (!notification) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json({ notification: { ...notification, id: notification._id.toString() } });
}

export async function markAllAsRead(req: Request, res: Response) {
  await Notification.updateMany({ userId: req.userId!, read: false }, { $set: { read: true } });
  res.json({ success: true });
}
