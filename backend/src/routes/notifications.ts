import { Router } from "express";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../controllers/notifications.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/", authMiddleware, asyncHandler(getNotifications));
router.get("/unread-count", authMiddleware, asyncHandler(getUnreadCount));
// Static route before the parameterised one.
router.patch("/read-all", authMiddleware, asyncHandler(markAllAsRead));
router.patch("/:id/read", authMiddleware, asyncHandler(markAsRead));

export default router;
