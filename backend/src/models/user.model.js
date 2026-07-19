import mongoose, { Schema } from "mongoose";

/**
 * User model — extended to store Google OAuth2 tokens.
 * Tokens are used by googleCalendarService.js to call the Google Calendar API
 * without requiring the user to re-authenticate on every request.
 */
const userSchema = new Schema({
  name:     { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email:    { type: String, default: null },   // email address (optional for legacy users)
  token:    { type: String },                  // session token (used by existing auth flow)

  // ── Google OAuth tokens (populated after /api/auth/google/callback) ──
  googleAccessToken:  { type: String, default: null },
  googleRefreshToken: { type: String, default: null },
  googleTokenExpiry:  { type: Date,   default: null },
  googleConnected:    { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);

export { User };
