import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema({
  user_id: { type: String }, // references user's username for backward compatibility
  meetingCode: { type: String, required: true },
  date: { type: Date, default: Date.now, required: true },
  
  // Google Meet Extensions
  hostId: { type: String },
  expiresAt: { type: Date },
  status: { type: String, default: "ACTIVE", enum: ["ACTIVE", "EXPIRED"] },
  meetingPassword: { type: String },
  waitingRoomEnabled: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isChatDisabled: { type: Boolean, default: false },
  isScreenShareDisabled: { type: Boolean, default: false },
  isMutedAll: { type: Boolean, default: false },

  // Redesign meeting details
  meetingId: { type: String },
  meetingLink: { type: String },
  meetingTitle: { type: String },
  description: { type: String },
  participants: { type: [String], default: [] },
  password: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };
