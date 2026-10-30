import { Router } from "express";
import { kycConfig, kycStart, kycStatus } from "../controllers/verification.js";
import { authMiddleware, requirePhoneVerified } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/config", authMiddleware, kycConfig);
router.post("/start", authMiddleware, requirePhoneVerified, asyncHandler(kycStart));
router.get("/status", authMiddleware, asyncHandler(kycStatus));

export default router;
