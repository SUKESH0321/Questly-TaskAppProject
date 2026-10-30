import { Router } from "express";
import { getUserById } from "../controllers/users.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/:id", authMiddleware, asyncHandler(getUserById));

export default router;
