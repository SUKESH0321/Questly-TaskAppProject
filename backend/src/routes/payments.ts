import { Router } from "express";
import { initiatePayment, releasePayment, getPayment, getMyPayments } from "../controllers/payments.js";
import { authMiddleware, requirePhoneVerified } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.post("/initiate", authMiddleware, requirePhoneVerified, asyncHandler(initiatePayment));
router.post("/release/:taskId", authMiddleware, asyncHandler(releasePayment));
router.get("/mine", authMiddleware, asyncHandler(getMyPayments));
router.get("/:taskId", authMiddleware, asyncHandler(getPayment));

export default router;
