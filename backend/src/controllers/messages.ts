import type { Request, Response } from "express";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Application } from "../models/Application.js";
import { isValidId } from "../utils/http.js";
import { notify } from "../utils/notify.js";

/** Returns the existing conversation between two users, or creates one. */
export async function findOrCreateConversation(userA: string, userB: string) {
  const existing = await Conversation.findOne({
    participantIds: { $all: [userA, userB], $size: 2 },
  });
  if (existing) return existing;
  return Conversation.create({ participantIds: [userA, userB], lastMessage: "", lastTime: "" });
}

async function publicUser(id: unknown) {
  if (!id) return null;
  const user = await User.findById(id).lean();
  if (!user) return null;
  return { id: user._id.toString(), name: user.name, avatar: user.avatar };
}

export async function getConversations(req: Request, res: Response) {
  const userId = req.userId!;

  const conversations = await Conversation.find({ participantIds: userId })
    .sort({ updatedAt: -1 })
    .lean();

  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const otherUserId = conv.participantIds.find((id) => id.toString() !== userId);
      return {
        ...conv,
        id: conv._id.toString(),
        otherUser: await publicUser(otherUserId),
      };
    }),
  );

  res.json({ conversations: enriched });
}

export async function getConversationById(req: Request, res: Response) {
  const userId = req.userId!;
  if (!isValidId(req.params.id)) {
    res.status(400).json({ error: "A valid conversation id is required." });
    return;
  }
  const conversation = await Conversation.findById(req.params.id).lean();

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }

  if (!conversation.participantIds.some((id) => id.toString() === userId)) {
    res.status(403).json({ error: "You are not a participant in this conversation." });
    return;
  }

  const otherUserId = conversation.participantIds.find((id) => id.toString() !== userId);

  res.json({
    conversation: {
      ...conversation,
      id: conversation._id.toString(),
      otherUser: await publicUser(otherUserId),
    },
  });
}

/**
 * Open (or reuse) a chat with another user. Allowed only when the two users are
 * connected through a task application, so strangers can't be spammed.
 */
export async function createConversation(req: Request, res: Response) {
  const { userId: otherId } = req.body;
  const userId = req.userId!;

  if (!isValidId(otherId)) {
    res.status(400).json({ error: "userId is required." });
    return;
  }
  if (otherId === userId) {
    res.status(400).json({ error: "You cannot message yourself." });
    return;
  }

  const other = await User.findById(otherId);
  if (!other) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const myTaskIds = await Task.find({ posterId: userId }).distinct("_id");
  const theirTaskIds = await Task.find({ posterId: otherId }).distinct("_id");
  const connected = await Application.exists({
    $or: [
      { taskId: { $in: myTaskIds }, applicantId: otherId },
      { taskId: { $in: theirTaskIds }, applicantId: userId },
    ],
  });
  if (!connected) {
    res.status(403).json({ error: "You can only message people you have a task application with." });
    return;
  }

  const existing = await Conversation.findOne({
    participantIds: { $all: [userId, otherId], $size: 2 },
  });
  const conversation = existing ?? (await findOrCreateConversation(userId, otherId));
  const obj = conversation.toObject();
  res.status(existing ? 200 : 201).json({
    conversation: { ...obj, id: obj._id.toString() },
    alreadyExists: !!existing,
  });
}

async function requireParticipant(req: Request, res: Response) {
  const { conversationId } = req.params;
  if (!isValidId(conversationId)) {
    res.status(400).json({ error: "A valid conversation id is required." });
    return null;
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return null;
  }
  if (!conversation.participantIds.some((id) => id.toString() === req.userId)) {
    res.status(403).json({ error: "You are not a participant in this conversation." });
    return null;
  }
  return conversation;
}

export async function getMessages(req: Request, res: Response) {
  const conversation = await requireParticipant(req, res);
  if (!conversation) return;

  const convMessages = await Message.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    messages: convMessages.map((m) => ({ ...m, id: m._id.toString() })),
  });
}

export async function sendMessage(req: Request, res: Response) {
  const conversation = await requireParticipant(req, res);
  if (!conversation) return;

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Message text is required." });
    return;
  }
  if (text.length > 2000) {
    res.status(400).json({ error: "Message is too long (max 2000 characters)." });
    return;
  }

  const newMessage = await Message.create({
    conversationId: conversation._id,
    senderId: req.userId!,
    text,
  });

  // `time` is derived on the client from createdAt; lastTime is kept as an ISO
  // timestamp so the list can render relative times.
  conversation.lastMessage = text;
  conversation.lastTime = new Date().toISOString();
  await conversation.save();

  const recipientId = conversation.participantIds.find((id) => id.toString() !== req.userId);
  if (recipientId) {
    const sender = await User.findById(req.userId).select("name").lean();
    await notify(
      recipientId,
      "message",
      `New message from ${sender?.name ?? "someone"}`,
      text,
      `/messages?conversationId=${conversation._id}`,
      { collapseUnread: true },
    );
  }

  const msgObj = newMessage.toObject();
  res.status(201).json({ message: { ...msgObj, id: msgObj._id.toString() } });
}
