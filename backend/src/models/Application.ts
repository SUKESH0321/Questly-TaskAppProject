import mongoose, { Schema, Document } from "mongoose";

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface IApplication extends Document {
  taskId: mongoose.Types.ObjectId;
  applicantId: mongoose.Types.ObjectId;
  applicantName: string;
  applicantAvatar?: string;
  applicantRating: number;
  message: string;
  status: ApplicationStatus;
  createdAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    applicantName: { type: String, required: true },
    applicantAvatar: { type: String, default: "" },
    applicantRating: { type: Number, default: 5 },
    message: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

// One application per tasker per task (also prevents double-apply races).
ApplicationSchema.index({ taskId: 1, applicantId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>("Application", ApplicationSchema);
