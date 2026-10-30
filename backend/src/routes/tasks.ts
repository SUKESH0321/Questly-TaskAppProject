import { Router } from "express";
import {
  getAllTasks,
  getMyPostedTasks,
  getMyWorkedTasks,
  getTaskById,
  getTasksByPoster,
  createTask,
  updateTask,
  cancelTask,
  applyToTask,
  getTaskApplications,
  acceptApplication,
  markWorkDone,
  repostTask,
  getTaskStats,
} from "../controllers/tasks.js";
import { authMiddleware, requirePhoneVerified } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/", asyncHandler(getAllTasks));
// Static routes must be declared before the "/:id" catch-all
router.get("/stats", asyncHandler(getTaskStats));
router.get("/posted", authMiddleware, asyncHandler(getMyPostedTasks));
router.get("/worked", authMiddleware, asyncHandler(getMyWorkedTasks));
router.get("/poster/:posterId", authMiddleware, asyncHandler(getTasksByPoster));
router.get("/:id", asyncHandler(getTaskById));
router.post("/", authMiddleware, requirePhoneVerified, asyncHandler(createTask));
router.patch("/:id", authMiddleware, asyncHandler(updateTask));
router.delete("/:id", authMiddleware, asyncHandler(cancelTask));

// Application flow
router.post("/:id/apply", authMiddleware, requirePhoneVerified, asyncHandler(applyToTask));
router.get("/:id/applications", authMiddleware, asyncHandler(getTaskApplications));
router.post(
  "/:id/applications/:applicationId/accept",
  authMiddleware,
  asyncHandler(acceptApplication),
);
router.post("/:id/done", authMiddleware, asyncHandler(markWorkDone));
router.post("/:id/repost", authMiddleware, asyncHandler(repostTask));

export default router;
