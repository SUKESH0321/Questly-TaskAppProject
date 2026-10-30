import { Router } from "express";
import { register, login, getMe, updateMe, changePassword } from "../controllers/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { sendPhoneOtp, verifyPhoneOtp } from "../controllers/verification.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getMe));
router.patch("/me", authMiddleware, asyncHandler(updateMe));
router.patch("/password", authMiddleware, asyncHandler(changePassword));
router.post("/phone/send-otp", authMiddleware, asyncHandler(sendPhoneOtp));
router.post("/phone/verify", authMiddleware, asyncHandler(verifyPhoneOtp));

export default router;
