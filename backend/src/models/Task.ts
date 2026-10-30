import mongoose, { Schema, Document } from "mongoose";

export type TaskStatus = "open" | "in_progress" | "completed" | "expired";

export interface ITask extends Document {
  title: string;
  description: string;
  category: string;
  budget: number;
  /** Optional extra (INR) the poster adds for a fast pickup; only with a 15 or 30 minute window. */
  urgencyBonus: number;
  rating: number;
  location: string;
  distance: string;
  time: string;
  date: string;
  imageUrl?: string;
  status: TaskStatus;
  posterId: mongoose.Types.ObjectId;
  posterName: string;
  posterAvatar?: string;
  posterRating: number;
  workerId?: mongoose.Types.ObjectId;
  workerName?: string;
  workerMarkedDone: boolean;
  /** End of the search window; null = no timer. */
  expiresAt?: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    budget: { type: Number, required: true },
    urgencyBonus: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    location: { type: String, default: "123 Main St, New York" },
    distance: { type: String, default: "0.5 miles" },
    time: { type: String, default: "ASAP" },
    date: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    status: { type: String, enum: ["open", "in_progress", "completed", "expired"], default: "open" },
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    posterName: { type: String, required: true },
    posterAvatar: { type: String, default: "" },
    posterRating: { type: Number, default: 5.0 },
    workerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    workerName: { type: String, default: "" },
    workerMarkedDone: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for the common queries (browse, my tasks, my work).
TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ posterId: 1, createdAt: -1 });
TaskSchema.index({ workerId: 1, createdAt: -1 });
// Lets the expiry sweeper find due tasks without scanning everything.
TaskSchema.index({ status: 1, expiresAt: 1 });

export const Task = mongoose.model<ITask>("Task", TaskSchema);