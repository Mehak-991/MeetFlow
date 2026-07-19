import mongoose, { Schema } from "mongoose";

/**
 * MeetFlow Meeting Model — Single Source of Truth
 * 
 * meetingCode  : The human-readable join code (e.g. "ABC123XYZ"). Used in every URL and API.
 * meetingLink  : Full URL for the meeting room (e.g. https://app.com/meeting/ABC123XYZ)
 * calendarEventId : Google Calendar event ID (stored after calendar event is created)
 * googleMeetLink  : The Google Meet link returned from Calendar API (if used)
 * hostId       : MongoDB ObjectId of the creating user — always use this for host checks
 * createdBy    : Username of the creator (denormalized for display purposes only)
 * organizerEmail : Email of the organizer (used for calendar invites)
 * attendees    : Array of invited email addresses
 * meetingStatus: "ACTIVE" | "EXPIRED" | "ENDED"
 */
const meetingSchema = new Schema({
  // Core identity
  meetingCode:   { type: String, required: true, unique: true, index: true },
  meetingLink:   { type: String },
  meetingTitle:  { type: String, default: "MeetFlow Meeting" },
  description:   { type: String, default: "" },

  // Host & ownership — hostId is a MongoDB User _id string for reliable comparison
  hostId:        { type: String, required: true }, // stores user._id.toString()
  createdBy:     { type: String },                 // stores user.username (display only)
  organizerEmail:{ type: String },

  // Attendees / invitees
  attendees:     { type: [String], default: [] },  // array of email addresses

  // Calendar integration (optional)
  calendarEventId: { type: String, default: null },
  googleMeetLink:  { type: String, default: null },

  // Meeting lifecycle
  meetingStatus: {
    type: String,
    default: "ACTIVE",
    enum: ["ACTIVE", "EXPIRED", "ENDED"]
  },
  expiresAt:     { type: Date, default: null },

  // Access control
  meetingPassword:    { type: String, default: null },
  waitingRoomEnabled: { type: Boolean, default: false },
  isLocked:           { type: Boolean, default: false },
  isChatDisabled:     { type: Boolean, default: false },
  isScreenShareDisabled: { type: Boolean, default: false },
  isMutedAll:         { type: Boolean, default: false },

  // History linkage (for user's meeting history)
  user_id:       { type: String }, // username — kept for backward compat with history lookup

  date:          { type: Date, default: Date.now },
  createdAt:     { type: Date, default: Date.now }
});

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };
