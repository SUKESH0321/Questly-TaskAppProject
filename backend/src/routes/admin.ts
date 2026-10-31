import { Router } from "express";
import { getAdminStats } from "../controllers/admin.js";
import { authMiddleware, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/stats", authMiddleware, requireAdmin, asyncHandler(getAdminStats));

export default router;
