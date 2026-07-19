/**
 * calendar.controller.js
 *
 * Google Calendar meeting management — fully migrated from Python scheduler.
 * Replaces: google_meet_scheduler/backend/routers/meetings.py
 *
 * All data is stored in MongoDB. No PostgreSQL.
 * Google Calendar is used ONLY for:
 *   - Creating calendar events with Google Meet links
 *   - Sending invitation emails via sendUpdates:"all"
 *   - Updating / cancelling events
 *   - Syncing RSVP status back
 *
 * Routes (registered in users.routes.js under /api/calendar):
 *   POST   /api/calendar/create               → create meeting + calendar event
 *   GET    /api/calendar/events               → list user's calendar meetings
 *   GET    /api/calendar/events/:meetingCode  → get single meeting details
 *   PUT    /api/calendar/events/:meetingCode/reschedule
 *   DELETE /api/calendar/events/:meetingCode
 *   POST   /api/calendar/events/:meetingCode/attendees
 *   DELETE /api/calendar/events/:meetingCode/attendees
 *   POST   /api/calendar/events/:meetingCode/resend-invitation
 *   POST   /api/calendar/sync-rsvp/:meetingCode
 *   GET    /api/calendar/upcoming             → list upcoming events from Google directly
 */

import httpStatus from "http-status";
import { User }    from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncRsvpFromGoogle,
  listUpcomingEvents,
} from "../services/googleCalendarService.js";
import { sendEmail } from "../services/emailService.js";

// ─── auth helper ─────────────────────────────────────────────────────────────
const getUserByToken = async (token) => {
  if (!token) return null;
  return await User.findOne({ token });
};

// ─── generate meetingCode ─────────────────────────────────────────────────────
const generateMeetingCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/create
// Creates a meeting in MongoDB + Google Calendar event with Meet link.
// Body: { token, title, description, startTime, endTime, timezone, attendees[],
//         waitingRoomEnabled, password }
// ─────────────────────────────────────────────────────────────────────────────
export const createCalendarMeeting = async (req, res) => {
  const {
    token,
    title,
    description,
    startTime,
    endTime,
    timezone = "UTC",
    attendees = [],
    waitingRoomEnabled = false,
    password,
  } = req.body;

  if (!token) return res.status(401).json({ message: "Unauthorized" });
  if (!title)  return res.status(400).json({ message: "Meeting title is required" });
  if (!startTime || !endTime) {
    return res.status(400).json({ message: "startTime and endTime are required" });
  }

  const start = new Date(startTime);
  const end   = new Date(endTime);
  if (end <= start) {
    return res.status(400).json({ message: "endTime must be after startTime" });
  }
  if ((end - start) / 60000 < 5) {
    return res.status(400).json({ message: "Meeting duration must be at least 5 minutes" });
  }

  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Check Google is connected
    if (!user.googleAccessToken) {
      return res.status(400).json({
        message:
          "Google Calendar is not connected. Please authenticate via GET /api/auth/google/url first.",
        requiresGoogleAuth: true,
      });
    }

    // Normalise attendees
    const attendeeList = Array.isArray(attendees)
      ? attendees.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))
      : [];

    // Generate unique meetingCode
    let meetingCode;
    let exists = true;
    while (exists) {
      meetingCode = generateMeetingCode();
      exists = !!(await Meeting.findOne({ meetingCode }));
    }

    const frontendUrl  = process.env.FRONTEND_URL || "http://localhost:3000";
    const meetingLink  = `${frontendUrl}/meeting/${meetingCode}`;

    // 1. Create Google Calendar event (sends invitation emails automatically)
    let calendarEventId = null;
    let googleMeetLink  = null;
    let organizerEmail  = user.email || user.username;

    try {
      const calResult = await createCalendarEvent(user._id.toString(), {
        title,
        description: description || "",
        startTime:   start,
        endTime:     end,
        timezone,
        attendees:   attendeeList,
      });
      calendarEventId = calResult.calendarEventId;
      googleMeetLink  = calResult.googleMeetLink;
      organizerEmail  = calResult.organizerEmail || organizerEmail;
      console.log(`[Calendar] Event created: ${calendarEventId} | Meet: ${googleMeetLink}`);
    } catch (calErr) {
      console.error("[Calendar] Google Calendar API error:", calErr.message);
      // We continue — saving to MongoDB even if Calendar fails
      // so the meeting is still usable via MeetFlow's own WebRTC
    }

    // 2. Save meeting in MongoDB
    const newMeeting = new Meeting({
      meetingCode,
      meetingLink,
      meetingTitle:       title,
      description:        description || "",
      hostId:             user._id.toString(),
      createdBy:          user.username,
      organizerEmail,
      attendees:          attendeeList,
      calendarEventId,
      googleMeetLink,
      meetingStatus:      "ACTIVE",
      waitingRoomEnabled: !!waitingRoomEnabled,
      meetingPassword:    password || null,
      user_id:            user.username,
      // Calendar-specific fields
      startTime:          start,
      endTime:            end,
      timezone,
      date:               new Date(),
      createdAt:          new Date(),
    });

    await newMeeting.save();
    console.log(`[Calendar] Meeting saved: ${meetingCode}`);

    return res.status(httpStatus.CREATED).json({
      success:         true,
      meetingCode,
      meetingLink,
      googleMeetLink:  googleMeetLink || null,
      calendarEventId: calendarEventId || null,
      organizerEmail,
      attendees:       attendeeList,
      startTime:       start,
      endTime:         end,
      timezone,
      meetingTitle:    title,
    });
  } catch (err) {
    console.error("[Calendar] createCalendarMeeting error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calendar/events?token=&page=&limit=&search=&status=
// Lists all calendar-linked meetings for the current user.
// ─────────────────────────────────────────────────────────────────────────────
export const listCalendarMeetings = async (req, res) => {
  const { token, page = 1, limit = 10, search, status: statusFilter } = req.query;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const query = {
      $or: [{ user_id: user.username }, { hostId: user._id.toString() }],
      calendarEventId: { $exists: true, $ne: null }, // only calendar-linked meetings
    };
    if (statusFilter) query.meetingStatus = statusFilter.toUpperCase();
    if (search)       query.meetingTitle  = { $regex: search, $options: "i" };

    const total    = await Meeting.countDocuments(query);
    const meetings = await Meeting.find(query)
      .sort({ startTime: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      meetings,
      total,
      page:  Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calendar/events/:meetingCode
// ─────────────────────────────────────────────────────────────────────────────
export const getCalendarMeeting = async (req, res) => {
  const { meetingCode } = req.params;
  const { token }       = req.query;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    // Auto-sync RSVPs if Google Calendar is connected
    if (meeting.calendarEventId && user.googleAccessToken) {
      try {
        const rsvps = await syncRsvpFromGoogle(user._id.toString(), meeting.calendarEventId);
        // Merge RSVP data into attendees array (stored as simple emails in our model)
        // We expose rsvps separately so the client can display status
        return res.status(200).json({ meeting, rsvps });
      } catch (syncErr) {
        console.error("[Calendar] RSVP sync error:", syncErr.message);
      }
    }

    return res.status(200).json({ meeting, rsvps: [] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/calendar/events/:meetingCode/reschedule
// Body: { token, startTime, endTime, timezone }
// ─────────────────────────────────────────────────────────────────────────────
export const rescheduleMeeting = async (req, res) => {
  const { meetingCode }            = req.params;
  const { token, startTime, endTime, timezone } = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can reschedule this meeting" });
    }

    const newStart = new Date(startTime);
    const newEnd   = new Date(endTime);
    if (newEnd <= newStart) {
      return res.status(400).json({ message: "endTime must be after startTime" });
    }

    // Update Google Calendar event
    if (meeting.calendarEventId && user.googleAccessToken) {
      try {
        await updateCalendarEvent(user._id.toString(), meeting.calendarEventId, {
          startTime: newStart,
          endTime:   newEnd,
          timezone:  timezone || meeting.timezone,
          attendees: meeting.attendees,
        });
      } catch (calErr) {
        console.error("[Calendar] Reschedule update error:", calErr.message);
      }
    }

    // Update MongoDB
    meeting.startTime     = newStart;
    meeting.endTime       = newEnd;
    if (timezone) meeting.timezone = timezone;
    meeting.meetingStatus = "ACTIVE";
    await meeting.save();

    return res.status(200).json({ success: true, message: "Meeting rescheduled", meeting });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/calendar/events/:meetingCode
// Cancels the Google Calendar event and marks meeting ENDED in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
export const cancelCalendarMeeting = async (req, res) => {
  const { meetingCode } = req.params;
  const { token }       = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can cancel this meeting" });
    }

    // Delete from Google Calendar
    if (meeting.calendarEventId && meeting.meetingStatus !== "ENDED") {
      try {
        await deleteCalendarEvent(user._id.toString(), meeting.calendarEventId);
      } catch (calErr) {
        console.error("[Calendar] Delete event error:", calErr.message);
      }
    }

    meeting.meetingStatus = "ENDED";
    await meeting.save();

    return res.status(200).json({ success: true, message: "Meeting cancelled" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/events/:meetingCode/attendees
// Body: { token, emails: [] }   — add attendees
// ─────────────────────────────────────────────────────────────────────────────
export const addAttendees = async (req, res) => {
  const { meetingCode }    = req.params;
  const { token, emails }  = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can add attendees" });
    }

    const newEmails = (Array.isArray(emails) ? emails : [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@") && !meeting.attendees.includes(e));

    if (!newEmails.length) {
      return res.status(200).json({
        success: true,
        message: "All attendees already invited",
        attendees: meeting.attendees,
      });
    }

    const updatedAttendees = [...meeting.attendees, ...newEmails];

    // Update Google Calendar event
    if (meeting.calendarEventId && user.googleAccessToken) {
      try {
        await updateCalendarEvent(user._id.toString(), meeting.calendarEventId, {
          attendees: updatedAttendees,
        });
      } catch (calErr) {
        console.error("[Calendar] addAttendees update error:", calErr.message);
      }
    }

    meeting.attendees = updatedAttendees;
    await meeting.save();

    return res.status(200).json({
      success: true,
      message: `Added ${newEmails.length} attendee(s)`,
      attendees: meeting.attendees,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/calendar/events/:meetingCode/attendees
// Body: { token, emails: [] }   — remove attendees
// ─────────────────────────────────────────────────────────────────────────────
export const removeAttendees = async (req, res) => {
  const { meetingCode }   = req.params;
  const { token, emails } = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can remove attendees" });
    }

    const toRemove = new Set(
      (Array.isArray(emails) ? emails : []).map((e) => e.trim().toLowerCase())
    );
    const updatedAttendees = meeting.attendees.filter((e) => !toRemove.has(e));

    if (meeting.calendarEventId && user.googleAccessToken) {
      try {
        await updateCalendarEvent(user._id.toString(), meeting.calendarEventId, {
          attendees: updatedAttendees,
        });
      } catch (calErr) {
        console.error("[Calendar] removeAttendees update error:", calErr.message);
      }
    }

    meeting.attendees = updatedAttendees;
    await meeting.save();

    return res.status(200).json({
      success: true,
      message: `Removed ${toRemove.size} attendee(s)`,
      attendees: meeting.attendees,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/events/:meetingCode/resend-invitation
// Body: { token }  — re-sends Google Calendar invitations to all attendees
// ─────────────────────────────────────────────────────────────────────────────
export const resendInvitations = async (req, res) => {
  const { meetingCode } = req.params;
  const { token }       = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can resend invitations" });
    }
    if (!meeting.calendarEventId) {
      return res.status(400).json({ message: "This meeting has no Google Calendar event" });
    }

    // Trigger an update with the same attendees — Google sends invitation emails
    await updateCalendarEvent(user._id.toString(), meeting.calendarEventId, {
      attendees: meeting.attendees,
    });

    return res.status(200).json({ success: true, message: "Invitations resent via Google Calendar" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/sync-rsvp/:meetingCode
// Body: { token }  — manually trigger RSVP sync from Google
// ─────────────────────────────────────────────────────────────────────────────
export const syncRsvp = async (req, res) => {
  const { meetingCode } = req.params;
  const { token }       = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (!meeting.calendarEventId) {
      return res.status(400).json({ message: "No Google Calendar event linked to this meeting" });
    }

    const rsvps = await syncRsvpFromGoogle(user._id.toString(), meeting.calendarEventId);
    return res.status(200).json({ success: true, rsvps });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/calendar/upcoming?token=&maxResults=
// Lists upcoming events directly from Google Calendar.
// ─────────────────────────────────────────────────────────────────────────────
export const getUpcomingEvents = async (req, res) => {
  const { token, maxResults = 10 } = req.query;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (!user.googleAccessToken) {
      return res.status(400).json({
        message: "Google Calendar not connected",
        requiresGoogleAuth: true,
      });
    }

    const events = await listUpcomingEvents(user._id.toString(), Number(maxResults));
    return res.status(200).json({ events });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
