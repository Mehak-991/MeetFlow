/**
 * src/services/api.js
 *
 * Single API client for the entire MeetFlow frontend.
 * Used by both the existing pages AND the migrated scheduler pages.
 *
 * All requests go to REACT_APP_API_URL (the single Node.js backend).
 * No more Next.js API layer, no more separate scheduler backend.
 *
 * Token storage:
 *   - Main MeetFlow auth uses localStorage key "token"
 *   - Google OAuth (scheduler) uses localStorage key "google_token"
 *   Both are sent in the Authorization header when present.
 */

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Get the active auth token — prefers Google token if present */
export const getAuthToken = () => {
  return (
    localStorage.getItem("google_token") ||
    localStorage.getItem("token") ||
    null
  );
};

export const setGoogleToken = (token) => {
  localStorage.setItem("google_token", token);
};

export const removeGoogleToken = () => {
  localStorage.removeItem("google_token");
  localStorage.removeItem("google_user");
};

export const getGoogleUser = () => {
  try {
    const raw = localStorage.getItem("google_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setGoogleUser = (user) => {
  localStorage.setItem("google_user", JSON.stringify(user));
};

/** Check if the user has connected Google Calendar */
export const isGoogleConnected = () => !!localStorage.getItem("google_token");

// ─── Core request helper ──────────────────────────────────────────────────────

/**
 * apiRequest(endpoint, options)
 *
 * Wraps fetch with:
 *  - Automatic base URL prepend
 *  - Authorization header injection
 *  - JSON content-type default
 *  - Error normalisation
 *
 * @param {string} endpoint   - e.g. "/api/auth/google/url"
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Don't force Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(url, { ...options, headers });

  // 401: Google token expired — clean up
  if (response.status === 401) {
    removeGoogleToken();
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || `Request failed: ${response.status}`
    );
  }

  return data;
};

// ─── Google Auth helpers ──────────────────────────────────────────────────────

/** GET /api/auth/google/url — returns the Google OAuth2 URL */
export const getGoogleOAuthUrl = () =>
  apiRequest("/api/auth/google/url");

/**
 * POST /api/auth/google/callback — exchange code for tokens
 * Also attaches the existing MeetFlow session token so Google is linked
 * to the already-logged-in user.
 */
export const exchangeGoogleCode = (code) => {
  const meetflowToken = localStorage.getItem("token") || undefined;
  return apiRequest("/api/auth/google/callback", {
    method: "POST",
    body: JSON.stringify({ code, token: meetflowToken }),
  });
};

/** GET /api/auth/google/status — is Google Calendar connected? */
export const getGoogleStatus = () => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/auth/google/status?token=${token}`);
};

// ─── Calendar meeting helpers ─────────────────────────────────────────────────

/**
 * POST /api/calendar/create
 * Creates a Google Calendar meeting with Meet link.
 */
export const createCalendarMeeting = (payload) => {
  const token = localStorage.getItem("token");
  return apiRequest("/api/calendar/create", {
    method: "POST",
    body: JSON.stringify({ ...payload, token }),
  });
};

/**
 * GET /api/calendar/events
 */
export const listCalendarMeetings = (params = {}) => {
  const token = localStorage.getItem("token");
  const q = new URLSearchParams({ token, ...params }).toString();
  return apiRequest(`/api/calendar/events?${q}`);
};

/**
 * GET /api/calendar/events/:meetingCode
 */
export const getCalendarMeeting = (meetingCode) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}?token=${token}`);
};

/**
 * PUT /api/calendar/events/:meetingCode/reschedule
 */
export const rescheduleCalendarMeeting = (meetingCode, payload) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}/reschedule`, {
    method: "PUT",
    body: JSON.stringify({ ...payload, token }),
  });
};

/**
 * DELETE /api/calendar/events/:meetingCode
 */
export const cancelCalendarMeeting = (meetingCode) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}`, {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
};

/**
 * POST /api/calendar/events/:meetingCode/attendees  — add attendees
 */
export const addCalendarAttendees = (meetingCode, emails) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}/attendees`, {
    method: "POST",
    body: JSON.stringify({ token, emails }),
  });
};

/**
 * DELETE /api/calendar/events/:meetingCode/attendees  — remove attendees
 */
export const removeCalendarAttendees = (meetingCode, emails) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}/attendees`, {
    method: "DELETE",
    body: JSON.stringify({ token, emails }),
  });
};

/**
 * POST /api/calendar/events/:meetingCode/resend-invitation
 */
export const resendCalendarInvitation = (meetingCode) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/events/${meetingCode}/resend-invitation`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
};

/**
 * POST /api/calendar/sync-rsvp/:meetingCode
 */
export const syncRsvp = (meetingCode) => {
  const token = localStorage.getItem("token");
  return apiRequest(`/api/calendar/sync-rsvp/${meetingCode}`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
};
