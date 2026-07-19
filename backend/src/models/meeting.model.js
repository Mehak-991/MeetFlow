/**
 * meeting.model.js — MongoDB Single Source of Truth for all meetings.
 *
 * Migration report — PostgreSQL → MongoDB field mapping:
 *
 *  PostgreSQL (meetings table)       → MongoDB field
 *  ─────────────────────────────────────────────────
 *  id (UUID)                         → _id (ObjectId, auto)
 *  title                             → meetingTitle
 *  description                       → description
 *  start_time                        → startTime
 *  end_time                          → endTime
 *  timezone                          → timezone
 *  meet_link (Google Meet URL)       → googleMeetLink
 *  calendar_event_id                 → calendarEventId
 *  organizer_email                   → organizerEmail
 *  attendees (JSON array of emails)  → attendees[]
 *  status (scheduled/completed/…)   → meetingStatus (ACTIVE/EXPIRED/ENDED)
 *  created_at                        → createdAt
 *  updated_at                        → updatedAt  ← NEW (was missing)
 *
 *  PostgreSQL (participants table)   → embedded in Participant model (separate collection)
 *                                      attendees[] stores emails here; RSVP detail in Participant doc
 *
 *  NEW fields added (were in PostgreSQL Participant / not in old MongoDB model):
 *  agenda              — meeting agenda text
 *  isRecurring         — recurring meeting flag
 *  updatedAt           — last modification timestamp
 *  googleCalendarId    — which Google calendar (default "primary")
 */

import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
  {
    // ── Core identity ────────────────────────────────────────────────────────
    meetingCode:  { type: String, required: true, unique: true, index: true },
    meetingLink:  { type: String },                      // MeetFlow join URL
    meetingTitle: { type: String, default: "MeetFlow Meeting" },
    description:  { type: String, default: "" },
    agenda:       { type: String, default: "" },         // NEW — meeting agenda

    // ── Host & ownership ─────────────────────────────────────────────────────
    // hostId MUST be user._id.toString() — never a username string
    hostId:         { type: String, required: true },
    createdBy:      { type: String },                    // username — display only
    organizerEmail: { type: String },

    // ── Attendees / invitees ─────────────────────────────────────────────────
    // Plain email list. RSVP detail lives in the Participant collection.
    attendees: { type: [String], default: [] },

    // ── Google Calendar integration ──────────────────────────────────────────
    // Maps 1-to-1 with PostgreSQL meetings.calendar_event_id / meet_link
    calendarEventId:  { type: String, default: null },   // Google Calendar event id
    googleMeetLink:   { type: String, default: null },   // https://meet.google.com/xxx-yyyy-zzz
    googleCalendarId: { type: String, default: "primary" }, // NEW — which calendar

    // ── Scheduled times (from PostgreSQL meetings.start_time / end_time) ─────
    startTime: { type: Date, default: null },
    endTime:   { type: Date, default: null },
    timezone:  { type: String, default: "UTC" },

    // ── Recurrence ───────────────────────────────────────────────────────────
    isRecurring: { type: Boolean, default: false },      // NEW

    // ── Meeting lifecycle ────────────────────────────────────────────────────
    meetingStatus: {
      type:    String,
      default: "ACTIVE",
      enum:    ["ACTIVE", "EXPIRED", "ENDED"],
    },
    expiresAt: { type: Date, default: null },

    // ── Access control ───────────────────────────────────────────────────────
    meetingPassword:       { type: String,  default: null },
    waitingRoomEnabled:    { type: Boolean, default: false },
    isLocked:              { type: Boolean, default: false },
    isChatDisabled:        { type: Boolean, default: false },
    isScreenShareDisabled: { type: Boolean, default: false },
    isMutedAll:            { type: Boolean, default: false },

    // ── Backward-compat history linkage ──────────────────────────────────────
    user_id: { type: String },   // stores username for legacy history queries
    date:    { type: Date, default: Date.now },
  },
  {
    // Mongoose auto-manages createdAt and updatedAt
    // Maps to PostgreSQL: created_at / updated_at
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

// Compound index — list meetings by host efficiently
meetingSchema.index({ hostId: 1, meetingStatus: 1 });
// Index for history queries (by username)
meetingSchema.index({ user_id: 1, createdAt: -1 });
// Index for calendar event lookups
meetingSchema.index({ calendarEventId: 1 }, { sparse: true });

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };
