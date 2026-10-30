import type { Request, Response } from "express";
import { Payment } from "../models/Payment.js";
import { Task } from "../models/Task.js";
import { isValidId } from "../utils/http.js";
import { notify } from "../utils/notify.js";

function toJson(p: { toObject?: () => any } | Record<string, any>) {
  const o = typeof (p as any).toObject === "function" ? (p as any).toObject() : p;
  return { ...o, id: o._id.toString() };
}

export async function initiatePayment(req: Request, res: Response) {
  const { taskId } = req.body ?? {};

  if (!isValidId(taskId)) {
    res.status(400).json({ error: "A valid taskId is required." });
    return;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  // Only the poster (task creator) can pay/hold payment for their own task
  if (task.posterId.toString() !== req.userId) {
    res.status(403).json({ error: "Only the task poster can pay for this task." });
    return;
  }

  // Payee is the assigned worker (tasker); nobody is paid without one.
  if (!task.workerId) {
    res
      .status(400)
      .json({ error: "A tasker must be assigned to this task before payment can be made." });
    return;
  }

  if (task.status !== "in_progress") {
    res.status(400).json({ error: "Payment can only be made for a task that is in progress." });
    return;
  }

  const existing = await Payment.exists({ taskId });
  if (existing) {
    res.status(409).json({ error: "Payment already initiated for this task." });
    return;
  }

  const newPayment = new Payment({
    taskId,
    payerId: req.userId!,
    payeeId: task.workerId,
    payeeName: task.workerName || "",
    amount: task.budget + (task.urgencyBonus || 0),
    status: "held",
  });

  try {
    await newPayment.save();
  } catch (err: any) {
    // Unique index on taskId: a concurrent request already created the payment.
    if (err?.code === 11000) {
      res.status(409).json({ error: "Payment already initiated for this task." });
      return;
    }
    throw err;
  }

  await notify(
    task.workerId,
    "payment",
    "Payment secured in escrow",
    `₹${task.budget + (task.urgencyBonus || 0)} for "${task.title}" is held. You can start the work.`,
    `/tasks/${task._id}`,
  );

  res.status(201).json({ payment: toJson(newPayment) });
}

export async function releasePayment(req: Request, res: Response) {
  const { taskId } = req.params;
  if (!isValidId(taskId)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }

  const payment = await Payment.findOne({ taskId });
  if (!payment) {
    res.status(404).json({ error: "Payment not found for this task." });
    return;
  }

  // Only the payer (poster) can release the escrowed payment
  if (payment.payerId.toString() !== req.userId) {
    res.status(403).json({ error: "Only the payer can release this payment." });
    return;
  }

  // Atomic transition: only one request can move held -> released.
  const released = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "held" },
    { $set: { status: "released", releasedAt: new Date() } },
    { new: true },
  );
  if (!released) {
    res.status(400).json({ error: `Cannot release a payment that is ${payment.status}.` });
    return;
  }

  // When payment is released, the task is complete.
  const doneTask = await Task.findByIdAndUpdate(released.taskId, { status: "completed" });

  await notify(
    released.payeeId,
    "payment",
    "Payment released",
    `₹${released.amount} for "${doneTask?.title ?? "your task"}" has been released to you.`,
    `/tasks/${released.taskId}`,
  );

  res.json({ payment: toJson(released) });
}

/** Only the payer or the payee of a payment may view it. */
export async function getPayment(req: Request, res: Response) {
  const { taskId } = req.params;
  if (!isValidId(taskId)) {
    res.status(400).json({ error: "A valid task id is required." });
    return;
  }

  const payment = await Payment.findOne({ taskId }).lean();
  const isParty =
    !!payment &&
    (payment.payerId.toString() === req.userId || payment.payeeId.toString() === req.userId);
  if (!payment || !isParty) {
    // Same response either way so payments of other people can't be probed.
    res.status(404).json({ error: "Payment not found for this task." });
    return;
  }

  res.json({ payment: toJson(payment) });
}

export async function getMyPayments(req: Request, res: Response) {
  const payments = await Payment.find({
    $or: [{ payerId: req.userId }, { payeeId: req.userId }],
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ payments: payments.map((p) => toJson(p)) });
}
