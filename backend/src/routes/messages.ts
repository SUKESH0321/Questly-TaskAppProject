import { Router } from "express";
import {
  getConversations,
  getConversationById,
  createConversation,
  getMessages,
  sendMessage,
} from "../controllers/messages.js";
import { authMiddleware, requirePhoneVerified } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/", authMiddleware, asyncHandler(getConversations));
router.post("/", authMiddleware, requirePhoneVerified, asyncHandler(createConversation));
router.get("/:id", authMiddleware, asyncHandler(getConversationById));
router.get("/:conversationId/messages", authMiddleware, asyncHandler(getMessages));
router.post("/:conversationId/messages", authMiddleware, requirePhoneVerified, asyncHandler(sendMessage));

export default router;
