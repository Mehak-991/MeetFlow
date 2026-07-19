/**
 * participant.model.js
 *
 * Migrated from PostgreSQL `participants` table.
 *
 *  PostgreSQL column          → MongoDB field
 *  ────────────────────────────────────────────
 *  id (UUID PK)               → _id (ObjectId)
 *  meeting_id (FK → meetings) → meetingCode  (uses meetingCode, not UUID)
 *  name                       → name
 *  email                      → email
 *  avatar                     → avatar
 *  role                       → role  ("host" | "guest")
 *  response_status            → responseStatus ("needsAction"|"accepted"|"declined"|"tentative")
 *  invitation_sent            → invitationSent
 *  invitation_sent_at         → invitationSentAt
 *  last_synced                → lastSynced
 *  accepted_at                → acceptedAt
 *  declined_at                → declinedAt
 *  tentative_at               → tentativeAt
 *  sync_error                 → syncError
 *  joined_at                  → joinedAt
 *  left_at                    → leftAt
 *  created_at / updated_at    → createdAt / updatedAt (via timestamps option)
 *
 * Key difference from PostgreSQL:
 *  - Uses meetingCode (string) instead of a UUID foreign key to meetings.id
 *  - This ensures consistency with the rest of the MeetFlow backend
 *    which always identifies meetings by meetingCode, never by _id.
 */

import mongoose, { Schema } from "mongoose";

const participantSchema = new Schema(
  {
    // ── Meeting reference ────────────────────────────────────────────────────
    // Uses meetingCode (not meeting._id) for consistency with all other models
    meetingCode: { type: String, required: true, index: true },

    // ── Identity ─────────────────────────────────────────────────────────────
    name:   { type: String, default: "" },
    email:  { type: String, required: true, lowercase: true, trim: true },
    avatar: { type: String, default: null },

    // ── Role ─────────────────────────────────────────────────────────────────
    role: {
      type:    String,
      default: "guest",
      enum:    ["host", "guest", "cohost"],
    },

    // ── RSVP / invitation status ─────────────────────────────────────────────
    responseStatus: {
      type:    String,
      default: "needsAction",
      enum:    ["needsAction", "accepted", "declined", "tentative"],
    },
    invitationSent:   { type: Boolean, default: true },
    invitationSentAt: { type: Date,    default: Date.now },

    // ── Google Calendar sync ──────────────────────────────────────────────────
    lastSynced:  { type: Date,   default: null },
    syncError:   { type: String, default: null },

    // ── RSVP timestamps ───────────────────────────────────────────────────────
    acceptedAt:  { type: Date, default: null },
    declinedAt:  { type: Date, default: null },
    tentativeAt: { type: Date, default: null },

    // ── Session tracking ──────────────────────────────────────────────────────
    joinedAt: { type: Date, default: null },
    leftAt:   { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

// Compound unique: one participant record per email per meeting
participantSchema.index({ meetingCode: 1, email: 1 }, { unique: true });

const Participant = mongoose.model("Participant", participantSchema);

export { Participant };
