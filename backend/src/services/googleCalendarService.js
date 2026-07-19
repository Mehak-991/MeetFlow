/**
 * googleCalendarService.js
 *
 * Google OAuth2 + Google Calendar API integration — fully in Node.js.
 * Replaces the Python calendar_service.py from google_meet_scheduler.
 *
 * Responsibilities:
 *  - Build OAuth2 authorization URL (GET /auth/google/url)
 *  - Exchange auth code for tokens (POST /auth/google/callback)
 *  - Refresh expired access tokens automatically
 *  - Create Google Calendar events with Google Meet links
 *  - Update existing calendar events (reschedule / change attendees)
 *  - Delete calendar events
 *  - Sync RSVP status back from Google Calendar into MongoDB
 *
 * All user Google tokens are stored on the User MongoDB document.
 * No PostgreSQL, no SQLAlchemy.
 */

import { google } from "googleapis";
import { User } from "../models/user.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 client factory — creates a fresh client per request
// ─────────────────────────────────────────────────────────────────────────────

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:8000/api/auth/google/callback"
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Generate the Google OAuth URL (step 1 of the OAuth flow)
// ─────────────────────────────────────────────────────────────────────────────

export const getGoogleAuthUrl = () => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Exchange auth code for tokens + fetch user profile
//    Returns: { email, name, googleAccessToken, googleRefreshToken, googleTokenExpiry }
// ─────────────────────────────────────────────────────────────────────────────

export const exchangeCodeForTokens = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // Fetch Google user profile
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  if (!profile.email) {
    throw new Error("Google account does not provide an email address.");
  }

  return {
    email: profile.email,
    name: profile.name || "",
    googleAccessToken: tokens.access_token,
    googleRefreshToken: tokens.refresh_token || null,
    googleTokenExpiry: tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Refresh token helper — checks expiry and refreshes if needed
//    Saves updated tokens to MongoDB User document.
//    Returns a ready-to-use OAuth2 client.
// ─────────────────────────────────────────────────────────────────────────────

export const getAuthenticatedClient = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  if (!user.googleAccessToken) {
    throw new Error(
      "User has not connected their Google account. Please authenticate via /api/auth/google/url first."
    );
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleTokenExpiry
      ? new Date(user.googleTokenExpiry).getTime()
      : null,
  });

  // Auto-refresh if token is expired or missing
  const now = Date.now();
  const expiry = user.googleTokenExpiry
    ? new Date(user.googleTokenExpiry).getTime()
    : 0;

  if (!expiry || now >= expiry - 60000) {
    // refresh if expired or within 60 seconds of expiry
    if (!user.googleRefreshToken) {
      throw new Error(
        "Google access token expired and no refresh token is available. Please reconnect your Google account."
      );
    }
    console.log(`[Google] Refreshing token for user ${user.email}`);
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Persist refreshed tokens
    user.googleAccessToken = credentials.access_token;
    if (credentials.refresh_token) {
      user.googleRefreshToken = credentials.refresh_token;
    }
    user.googleTokenExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);
    await user.save();
    console.log(`[Google] Token refreshed for ${user.email}`);
  }

  return { oauth2Client, user };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Create a Google Calendar event with a Google Meet conference link
//    Sends invitation emails automatically (sendUpdates: "all")
//
//    @param userId   - MongoDB User._id of the organizer
//    @param eventData - { title, description, startTime, endTime, timezone, attendees[] }
//    @returns { calendarEventId, googleMeetLink, organizerEmail }
// ─────────────────────────────────────────────────────────────────────────────

export const createCalendarEvent = async (userId, eventData) => {
  const { oauth2Client, user } = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Build the attendees list — filter out invalid emails
  const attendeesList = (eventData.attendees || [])
    .filter((email) => typeof email === "string" && email.includes("@"))
    .map((email) => ({ email: email.trim().toLowerCase() }));

  const requestId = `meetflow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const eventBody = {
    summary: eventData.title,
    description: eventData.description || "",
    start: {
      dateTime: new Date(eventData.startTime).toISOString(),
      timeZone: eventData.timezone || "UTC",
    },
    end: {
      dateTime: new Date(eventData.endTime).toISOString(),
      timeZone: eventData.timezone || "UTC",
    },
    attendees: attendeesList,
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };

  console.log("[Google Calendar] Creating event:", eventData.title);
  console.log("[Google Calendar] Attendees:", attendeesList.map((a) => a.email));

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
    conferenceDataVersion: 1,
    sendUpdates: "all", // sends invitation emails to all attendees
  });

  const event = response.data;
  console.log("[Google Calendar] Event created. ID:", event.id);

  // Extract Google Meet link from conference entry points
  let googleMeetLink = null;
  const entryPoints = event.conferenceData?.entryPoints || [];
  for (const ep of entryPoints) {
    if (ep.entryPointType === "video") {
      googleMeetLink = ep.uri;
      break;
    }
  }

  return {
    calendarEventId: event.id,
    googleMeetLink: googleMeetLink || "",
    organizerEmail: event.organizer?.email || user.email,
    htmlLink: event.htmlLink || "",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Update an existing Google Calendar event
//    Used for rescheduling or adding/removing attendees.
//    @param attendees  - optional new attendees array; if omitted, existing attendees kept
// ─────────────────────────────────────────────────────────────────────────────

export const updateCalendarEvent = async (
  userId,
  calendarEventId,
  { startTime, endTime, timezone, attendees } = {}
) => {
  const { oauth2Client } = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Fetch the existing event first
  const existing = await calendar.events.get({
    calendarId: "primary",
    eventId: calendarEventId,
  });
  const eventBody = existing.data;

  if (startTime) {
    eventBody.start = {
      dateTime: new Date(startTime).toISOString(),
      timeZone: timezone || eventBody.start.timeZone,
    };
  }
  if (endTime) {
    eventBody.end = {
      dateTime: new Date(endTime).toISOString(),
      timeZone: timezone || eventBody.end.timeZone,
    };
  }
  if (Array.isArray(attendees)) {
    eventBody.attendees = attendees
      .filter((e) => typeof e === "string" && e.includes("@"))
      .map((e) => ({ email: e.trim().toLowerCase() }));
  }

  console.log(`[Google Calendar] Updating event ${calendarEventId}`);

  const response = await calendar.events.update({
    calendarId: "primary",
    eventId: calendarEventId,
    requestBody: eventBody,
    sendUpdates: "all",
  });

  console.log(`[Google Calendar] Event updated. ID: ${response.data.id}`);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Delete a Google Calendar event (sends cancellation emails)
// ─────────────────────────────────────────────────────────────────────────────

export const deleteCalendarEvent = async (userId, calendarEventId) => {
  try {
    const { oauth2Client } = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    console.log(`[Google Calendar] Deleting event ${calendarEventId}`);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: calendarEventId,
      sendUpdates: "all",
    });
    console.log(`[Google Calendar] Event ${calendarEventId} deleted.`);
    return true;
  } catch (err) {
    // 410 = already deleted, treat as success
    if (err.code === 410 || err.status === 410) {
      console.warn(`[Google Calendar] Event ${calendarEventId} already deleted (410).`);
      return true;
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Sync RSVP status from Google Calendar into MongoDB
//    Returns an array of { email, responseStatus } objects
// ─────────────────────────────────────────────────────────────────────────────

export const syncRsvpFromGoogle = async (userId, calendarEventId) => {
  try {
    const { oauth2Client } = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const { data: event } = await calendar.events.get({
      calendarId: "primary",
      eventId: calendarEventId,
    });

    const attendees = event.attendees || [];
    console.log(
      `[Google Calendar] RSVP sync for event ${calendarEventId}: ${attendees.length} attendees`
    );

    return attendees.map((a) => ({
      email: (a.email || "").toLowerCase(),
      displayName: a.displayName || "",
      responseStatus: a.responseStatus || "needsAction", // needsAction | accepted | declined | tentative
    }));
  } catch (err) {
    console.error(`[Google Calendar] RSVP sync failed for ${calendarEventId}:`, err.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. List upcoming events from user's primary calendar
// ─────────────────────────────────────────────────────────────────────────────

export const listUpcomingEvents = async (userId, maxResults = 10) => {
  const { oauth2Client } = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return data.items || [];
};
