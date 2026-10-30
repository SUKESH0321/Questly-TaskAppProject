import mongoose, { Schema, Document } from "mongoose";

export type NotificationType = "application" | "message" | "payment" | "review" | "status" | "system";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  link: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["application", "message", "payment", "review", "status", "system"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    time: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);