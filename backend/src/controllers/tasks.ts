import type { Request, Response } from "express";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { Application } from "../models/Application.js";
import { Payment } from "../models/Payment.js";
import { isValidId } from "../utils/http.js";
import { env } from "../config/env.js";
import { notify } from "../utils/notify.js";
import { findOrCreateConversation } from "./messages.js";
import { expiryFromMinutes, parseSearchMinutes, parseUrgencyBonus, URGENT_WINDOWS } from "../utils/expiry.js";

/**
 * Poster name/avatar/rating are read from the user at request time, so profile
 * changes show up on old tasks (and large avatars aren't copied into every task).
 */
async function withFreshPosters<
  T extends { posterId: { toString(): string }; posterName: string; posterAvatar?: string; posterRating: number },
>(tasks: T[]): Promise<T[]> {
  if (tasks.length === 0) return tasks;
  const ids = [...new Set(tasks.map((t) => t.posterId.toString()))];
  const users = await User.find({ _id: { $in: ids } })
    .select("name avatar rating")
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  return tasks.map((t) => {
    const u = byId.get(t.posterId.toString());
    return u ? { ...t, posterName: u.name, posterAvatar: u.avatar || "", posterRating: u.rating } : t;
  });
}

export async function getAllTasks(req: Request, res: Response) {
  const { search, category, minBudget, maxBudget, sortBy } = req.query;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 30, 1), 100);
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);

  // Build filter
  const filter: Record<string, any> = {};

  // Hide completed tasks from the public browse list
  filter.status = { $nin: ["completed", "expired"] };

  if (search && typeof search === "string") {
    // Escape regex metacharacters so user input can't inject patterns (ReDoS).
    const q = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  if (category && typeof category === "string" && category !== "All") {
    filter.category = category;
  }

  const min = typeof minBudget === "string" ? Number(minBudget) : NaN;
  const max = typeof maxBudget === "string" ? Number(maxBudget) : NaN;
  if (Number.isFinite(min)) {
    filter.budget = { ...filter.budget, $gte: min };
  }
  if (Number.isFinite(max)) {
    filter.budget = { ...filter.budget, $lte: max };
  }

  // Build sort
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sortBy && typeof sortBy === "string") {
    switch (sortBy) {
      case "budget_high":
        sortOption = { budget: -1 };
        break;
      case "budget_low":
        sortOption = { budget: 1 };
        break;
      case "date":
        sortOption = { createdAt: -1 };
        break;
    }
  }

  // Fetch one extra row to know whether another page exists. _id breaks sort ties
  // so pages never overlap.
  const rows = await Task.find(filter)
    .sort({ ...sortOption, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const tasks = rows.slice(0, limit);

  const normalized = (await withFreshPosters(tasks)).map((t) => ({
    ...t,
    id: t._id.toString(),
  }));

  // serverNow lets clients show countdowns that match the server's clock.
  res.json({ tasks: normalized, hasMore, page, serverNow: new Date().toISOString() });
}

export async function getMyPostedTasks(req: Request, res: Response) {
  // Returns all tasks the authenticated user has posted (including completed),
  // so the poster can always see every task they created.
  const filter: Record<string, any> = { posterId: req.userId };

  const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
  const normalized = (await withFreshPosters(tasks)).map((t) => ({
    ...t,
    id: t._id.toString(),
  }));

  res.json({ tasks: normalized });
}

export async function getMyWorkedTasks(req: Request, res: Response) {
  // Returns all tasks the authenticated user has been assigned to work on
  // (including completed), so a worker can see everything they finished.
  const filter: Record<string, any> = { workerId: req.userId };

  const tasks = await Task.find(filter).sort({ createdAt: -1 }).lean();
  const normalized = (await withFreshPosters(tasks)).map((t) => ({
    ...t,
    id: t._id.toString(),
  }));

  res.json({ tasks: normalized });
}

export async function getTasksByPoster(req: Request, res: Response) {
  const { posterId } = req.params;

  if (!isValidId(posterId)) {
    res.status(400).json({ error: "A valid user id is required." });
    return;
  }

  // Only show open / in-progress tasks a user has posted publicly.
  const tasks = await Task.find({ posterId, status: { $nin: ["completed", "expired"] } })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    tasks: (await withFreshPosters(tasks)).map((t) => ({ ...t, id: t._id.toString() })),
  });
}

export async function getTaskById(req: Request, res: Response) {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }

  const task = await Task.findById(id).lean();
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  const [fresh] = await withFreshPosters([task]);
  res.json({ task: { ...fresh, id: task._id.toString() }, serverNow: new Date().toISOString() });
}

const MAX_IMAGE_CHARS = 2_000_000;

type TaskFields = {
  title?: string;
  description?: string;
  category?: string;
  budget?: number;
  location?: string;
  time?: string;
  date?: string;
  imageUrl?: string;
};

/** Reads a trimmed string field with a max length; returns undefined when absent. */
function readText(
  body: Record<string, unknown>,
  key: string,
  label: string,
  max: number,
  min = 1,
): { value?: string; error?: string } {
  const raw = body[key];
  if (raw === undefined) return {};
  if (typeof raw !== "string") return { error: `${label} must be text.` };
  const value = raw.trim();
  if (value.length < min) return { error: `${label} is required.` };
  if (value.length > max) return { error: `${label} must be at most ${max} characters.` };
  return { value };
}

/** Validates the editable task fields shared by create and update. */
function parseTaskFields(body: Record<string, unknown>): { fields: TaskFields; error?: string } {
  const fields: TaskFields = {};

  const specs: [keyof TaskFields, string, number, number][] = [
    ["title", "Title", 120, 3],
    ["description", "Description", 5000, 10],
    ["category", "Category", 60, 1],
    ["location", "Location", 200, 0],
    ["time", "Time", 60, 0],
    ["date", "Date", 60, 0],
  ];
  for (const [key, label, max, min] of specs) {
    const r = readText(body, key, label, max, min);
    if (r.error) return { fields, error: r.error };
    if (r.value !== undefined) (fields as Record<string, string>)[key] = r.value;
  }

  if (body.budget !== undefined) {
    const n = Number(body.budget);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) {
      return { fields, error: "Budget must be a positive number." };
    }
    fields.budget = n;
  }

  // Image must be an image data URL or an http(s) URL; "" clears it.
  if (body.imageUrl !== undefined) {
    const img = body.imageUrl;
    const ok =
      typeof img === "string" &&
      (img === "" ||
        (img.length <= MAX_IMAGE_CHARS &&
          (img.startsWith("data:image/") || /^https?:\/\//i.test(img))));
    if (!ok) {
      return { fields, error: "imageUrl must be a valid image data URL or http(s) URL." };
    }
    fields.imageUrl = img as string;
  }

  return { fields };
}

export async function createTask(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { fields, error } = parseTaskFields(body);

  if (error) {
    res.status(400).json({ error });
    return;
  }
  if (!fields.title || !fields.description || !fields.category || !fields.budget) {
    res.status(400).json({
      error: "Title (3+ chars), description (10+ chars), category, and budget are required.",
    });
    return;
  }

  const searchMinutes = parseSearchMinutes(body.searchMinutes);
  if (searchMinutes === null) {
    res.status(400).json({ error: "searchMinutes must be one of 0, 15, 30, 60, 180 or 1440." });
    return;
  }

  const urgencyBonus = parseUrgencyBonus(body.urgencyBonus, searchMinutes);
  if (urgencyBonus === null) {
    res.status(400).json({ error: "urgencyBonus must be 0, 10, 25, 50 or 75, and only with a 15 or 30 minute search window." });
    return;
  }

  const userId = req.userId!;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const newTask = new Task({
    title: fields.title,
    description: fields.description,
    category: fields.category,
    budget: fields.budget,
    urgencyBonus,
    location: fields.location || user.location || "Location not specified",
    time: fields.time || "ASAP",
    date: fields.date || new Date().toISOString().split("T")[0],
    imageUrl: fields.imageUrl || "",
    posterId: userId,
    posterName: user.name,
    posterAvatar: "",
    expiresAt: expiryFromMinutes(searchMinutes),
    posterRating: user.rating || 5.0,
  });

  await newTask.save();
  res.status(201).json({ task: toTaskJson(newTask) });
}

export async function updateTask(req: Request, res: Response) {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  if (task.posterId.toString() !== req.userId) {
    res.status(403).json({ error: "You can only update your own tasks." });
    return;
  }

  // Once a tasker is assigned (or work is done) the agreed terms are locked, so
  // budget/details cannot change underneath a held payment.
  if (task.status !== "open") {
    res.status(400).json({ error: "Only open tasks can be edited." });
    return;
  }

  const { fields, error } = parseTaskFields((req.body ?? {}) as Record<string, unknown>);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  // Status is never set directly: it moves open -> in_progress via accepting an
  // application, and in_progress -> completed via releasing the escrow payment.
  Object.assign(task, fields);
  await task.save();

  res.json({ task: toTaskJson(task) });
}

function toTaskJson(task: { toObject: () => any }) {
  const saved = task.toObject();
  return { ...saved, id: saved._id.toString() };
}

function toApplicationJson(a: { toObject: () => any }) {
  const o = a.toObject();
  return { ...o, id: o._id.toString() };
}

/** Tasker applies to an open task. Does NOT change the task status. */
export async function applyToTask(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }

  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (user.role !== "tasker" && user.role !== "both") {
    res.status(403).json({ error: "Only taskers can apply for tasks. Switch your role in Settings first." });
    return;
  }
  if (env.kyc.required && user.kycStatus !== "verified") {
    res.status(403).json({ error: "Verify your identity in Settings to apply for tasks.", code: "KYC_REQUIRED" });
    return;
  }

  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (task.posterId.toString() === req.userId) {
    res.status(400).json({ error: "You cannot apply for your own task." });
    return;
  }
  if (task.status !== "open") {
    res.status(400).json({ error: "This task is no longer accepting applications." });
    return;
  }
  if (task.expiresAt && task.expiresAt.getTime() <= Date.now()) {
    res.status(400).json({ error: "The search window for this task has ended." });
    return;
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 1000) : "";

  let application;
  try {
    application = await Application.create({
      taskId: task._id,
      applicantId: user._id,
      applicantName: user.name,
      applicantAvatar: user.avatar,
      applicantRating: user.rating,
      message,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: "You have already applied for this task." });
      return;
    }
    throw err;
  }

  const conversation = await findOrCreateConversation(req.userId!, task.posterId.toString());

  await notify(
    task.posterId,
    "application",
    "New application",
    `${user.name} applied for "${task.title}"`,
    `/tasks/${task._id}`,
  );

  res.status(201).json({
    application: toApplicationJson(application),
    conversationId: conversation._id.toString(),
  });
}

/**
 * Poster: every applicant for the task.
 * Anyone else: only their own application (so the UI can show "Applied").
 */
export async function getTaskApplications(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }
  const task = await Task.findById(id).lean();
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  const isPoster = task.posterId.toString() === req.userId;
  const filter = isPoster ? { taskId: id } : { taskId: id, applicantId: req.userId };
  const apps = await Application.find(filter).sort({ createdAt: -1 }).lean();

  // Show a verified badge next to applicants who passed identity verification.
  const applicants = await User.find({ _id: { $in: apps.map((a) => a.applicantId) } })
    .select("kycStatus")
    .lean();
  const verified = new Set(applicants.filter((u) => u.kycStatus === "verified").map((u) => u._id.toString()));

  res.json({
    applications: apps.map((a) => ({
      ...a,
      id: a._id.toString(),
      applicantVerified: verified.has(a.applicantId.toString()),
      applicantDemo: env.kyc.demo,
    })),
  });
}

/** Poster accepts one applicant: assigns the worker and rejects the rest. */
export async function acceptApplication(req: Request, res: Response) {
  const { id, applicationId } = req.params;
  if (!isValidId(id) || !isValidId(applicationId)) {
    res.status(400).json({ error: "Valid task and application ids are required." });
    return;
  }

  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (task.posterId.toString() !== req.userId) {
    res.status(403).json({ error: "Only the task poster can accept an applicant." });
    return;
  }

  const application = await Application.findOne({ _id: applicationId, taskId: id });
  if (!application) {
    res.status(404).json({ error: "Application not found." });
    return;
  }

  // Atomic claim: only flips the task if it is still open.
  const claimed = await Task.findOneAndUpdate(
    { _id: id, status: "open" },
    {
      $set: {
        status: "in_progress",
        workerId: application.applicantId,
        workerName: application.applicantName,
        workerMarkedDone: false,
      },
    },
    { new: true },
  );
  if (!claimed) {
    res.status(409).json({ error: "This task already has an assigned tasker." });
    return;
  }

  application.status = "accepted";
  await application.save();
  const rejected = await Application.find({ taskId: id, _id: { $ne: application._id } }).lean();
  await Application.updateMany(
    { taskId: id, _id: { $ne: application._id } },
    { $set: { status: "rejected" } },
  );

  const conversation = await findOrCreateConversation(
    req.userId!,
    application.applicantId.toString(),
  );

  await notify(
    application.applicantId,
    "status",
    "You got the task!",
    `${claimed.posterName} accepted you for "${claimed.title}"`,
    `/tasks/${claimed._id}`,
  );
  await Promise.all(
    rejected.map((a) =>
      notify(
        a.applicantId,
        "status",
        "Task filled",
        `"${claimed.title}" went to another tasker`,
        `/tasks/${claimed._id}`,
      ),
    ),
  );

  res.json({ task: toTaskJson(claimed), conversationId: conversation._id.toString() });
}

/** Assigned tasker signals the work is finished; the poster then releases payment. */
export async function markWorkDone(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }
  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (!task.workerId || task.workerId.toString() !== req.userId) {
    res.status(403).json({ error: "Only the assigned tasker can mark the work as done." });
    return;
  }
  if (task.status !== "in_progress") {
    res.status(400).json({ error: "This task is not in progress." });
    return;
  }

  task.workerMarkedDone = true;
  await task.save();
  await notify(
    task.posterId,
    "status",
    "Work marked as done",
    `${task.workerName || "Your tasker"} finished "${task.title}". Release the payment to complete it.`,
    `/tasks/${task._id}`,
  );
  res.json({ task: toTaskJson(task) });
}

/** Poster deletes an open, unpaid task. */
export async function cancelTask(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }
  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (task.posterId.toString() !== req.userId) {
    res.status(403).json({ error: "You can only delete your own tasks." });
    return;
  }
  if ((task.status !== "open" && task.status !== "expired") || (await Payment.exists({ taskId: task._id }))) {
    res.status(400).json({ error: "Only open or expired, unpaid tasks can be deleted." });
    return;
  }
  await Application.deleteMany({ taskId: task._id });
  await task.deleteOne();
  res.json({ success: true });
}

/** Poster restarts the search for an expired task with a fresh window. */
export async function repostTask(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }
  const minutes = parseSearchMinutes(req.body?.searchMinutes);
  if (minutes === null) {
    res.status(400).json({ error: "searchMinutes must be one of 0, 15, 30, 60, 180 or 1440." });
    return;
  }
  const task = await Task.findById(id);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (task.posterId.toString() !== req.userId) {
    res.status(403).json({ error: "You can only repost your own tasks." });
    return;
  }
  if (task.status !== "expired") {
    res.status(400).json({ error: "Only expired tasks can be reposted." });
    return;
  }

  // Atomic: a double tap can't repost twice.
  const reopened = await Task.findOneAndUpdate(
    { _id: id, status: "expired" },
    {
      $set: {
        status: "open",
        expiredAt: null,
        expiresAt: expiryFromMinutes(minutes),
        // The urgency tip only makes sense for a 15 or 30 minute search.
        ...(URGENT_WINDOWS.includes(minutes) ? {} : { urgencyBonus: 0 }),
      },
    },
    { new: true },
  );
  if (!reopened) {
    res.status(409).json({ error: "This task was already reposted." });
    return;
  }
  res.json({ task: toTaskJson(reopened), serverNow: new Date().toISOString() });
}

/** Counts of currently listed tasks per category, for filter chips and the home page. */
export async function getTaskStats(_req: Request, res: Response) {
  const rows = await Task.aggregate<{ _id: string; n: number }>([
    { $match: { status: { $nin: ["completed", "expired"] } } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
  ]);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byCategory[r._id] = r.n;
    total += r.n;
  }
  res.json({ total, byCategory });
}
