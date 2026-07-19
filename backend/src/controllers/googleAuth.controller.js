/**
 * googleAuth.controller.js
 *
 * Handles the Google OAuth2 login flow, replacing the Python FastAPI auth router.
 *
 * Routes (added to users.routes.js):
 *   GET  /api/auth/google/url      → returns the Google OAuth URL
 *   POST /api/auth/google/callback → exchanges code, upserts user, returns JWT-style token
 *   GET  /api/auth/google/status   → returns whether current user has Google connected
 *   POST /api/auth/google/disconnect → removes stored Google tokens
 */

import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
} from "../services/googleCalendarService.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google/url
// Returns the Google OAuth2 authorization URL.
// The frontend redirects the user to this URL.
// ─────────────────────────────────────────────────────────────────────────────
export const getGoogleOAuthUrl = (req, res) => {
  try {
    const url = getGoogleAuthUrl();
    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google/callback
// Body: { code: string, token?: string }
//   - code   : the authorization code from Google
//   - token  : (optional) existing MeetFlow session token to link Google to
//              an already logged-in user. If omitted, a matching user is found
//              by email or a new one is created.
//
// Returns: { token, userId, username, email, name, googleConnected }
// ─────────────────────────────────────────────────────────────────────────────
export const handleGoogleCallback = async (req, res) => {
  const { code, token } = req.body;
  if (!code) {
    return res.status(400).json({ message: "Authorization code is required." });
  }

  try {
    // 1. Exchange code for Google tokens + profile
    const {
      email,
      name,
      googleAccessToken,
      googleRefreshToken,
      googleTokenExpiry,
    } = await exchangeCodeForTokens(code);

    let user = null;

    // 2a. If a MeetFlow session token was provided, link Google to that user
    if (token) {
      user = await User.findOne({ token });
    }

    // 2b. Otherwise find by Google email
    if (!user) {
      user = await User.findOne({ email });
    }

    // 2c. If still not found, try matching by username (email address as username)
    if (!user) {
      user = await User.findOne({ username: email });
    }

    if (!user) {
      // 2d. Create a new lightweight user account linked to Google
      const crypto = await import("crypto");
      const newToken = crypto.default.randomBytes(20).toString("hex");
      user = new User({
        name: name || email.split("@")[0],
        username: email,
        email,
        password: crypto.default.randomBytes(32).toString("hex"), // random unusable password
        token: newToken,
        googleAccessToken,
        googleRefreshToken,
        googleTokenExpiry,
        googleConnected: true,
      });
      await user.save();
    } else {
      // Update existing user's Google tokens
      user.googleAccessToken = googleAccessToken;
      if (googleRefreshToken) user.googleRefreshToken = googleRefreshToken;
      user.googleTokenExpiry = googleTokenExpiry;
      user.googleConnected = true;
      if (!user.email) user.email = email;
      if (!user.name || user.name === user.username) user.name = name || user.name;
      await user.save();
    }

    console.log(`[GoogleAuth] User ${user.email} connected to Google Calendar.`);

    return res.status(httpStatus.OK).json({
      token: user.token,
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      name: user.name,
      googleConnected: true,
    });
  } catch (err) {
    console.error("[GoogleAuth] Callback error:", err.message);
    return res.status(500).json({ message: `Google authentication failed: ${err.message}` });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google/status
// Query: ?token=<session_token>
// Returns whether the current user has Google Calendar connected.
// ─────────────────────────────────────────────────────────────────────────────
export const getGoogleConnectionStatus = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ message: "Token required." });

  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Unauthorized." });

    return res.status(200).json({
      googleConnected: !!user.googleConnected && !!user.googleAccessToken,
      email: user.email,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google/disconnect
// Body: { token: string }
// Removes Google tokens from the user document.
// ─────────────────────────────────────────────────────────────────────────────
export const disconnectGoogle = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: "Token required." });

  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Unauthorized." });

    user.googleAccessToken = null;
    user.googleRefreshToken = null;
    user.googleTokenExpiry = null;
    user.googleConnected = false;
    await user.save();

    return res.status(200).json({ message: "Google account disconnected." });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
