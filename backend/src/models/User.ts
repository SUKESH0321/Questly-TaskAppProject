import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "customer" | "tasker" | "both" | "admin" | null;
export type KycStatus = "none" | "pending" | "verified" | "rejected";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  location?: string;
  avatar?: string;
  portfolioImages?: string[];
  // Tasker profile (collected during onboarding, editable in Settings)
  about?: string;
  skills?: string[];
  education?: string;
  certificates?: string;
  portfolioLink?: string;
  workingDays?: string[];
  startTime?: string;
  endTime?: string;
  travelRadius?: number;
  phoneVerified: boolean;
  phoneVerifiedAt?: Date;
  // Identity verification. We never store the Aadhaar number, only the last 4
  // digits returned by the provider and the provider's reference.
  kycStatus: KycStatus;
  kycProvider?: string;
  kycReference?: string;
  kycStartedAt?: Date;
  kycConsentAt?: Date;
  kycVerifiedAt?: Date;
  kycAadhaarLast4?: string;
  kycRejectionReason?: string;
  rating: number;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["customer", "tasker", "both", "admin", null], default: null },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    avatar: { type: String, default: "" },
    portfolioImages: { type: [String], default: [] },
    about: { type: String, default: "" },
    skills: { type: [String], default: [] },
    education: { type: String, default: "" },
    certificates: { type: String, default: "" },
    portfolioLink: { type: String, default: "" },
    workingDays: { type: [String], default: [] },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "17:00" },
    travelRadius: { type: Number, default: 10 },
    phoneVerified: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date },
    kycStatus: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
    kycProvider: { type: String, default: "" },
    kycReference: { type: String, default: "" },
    kycStartedAt: { type: Date },
    kycConsentAt: { type: Date },
    kycVerifiedAt: { type: Date },
    kycAadhaarLast4: { type: String, default: "" },
    kycRejectionReason: { type: String, default: "" },
    rating: { type: Number, default: 5.0 },
  },
  { timestamps: true }
);

// A mobile number can be verified on only one account.
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phoneVerified: true, phone: { $type: "string" } } },
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
UserSchema.set("toJSON", {
  transform: (_doc: any, ret: Record<string, any>) => {
    delete ret.password;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", UserSchema);