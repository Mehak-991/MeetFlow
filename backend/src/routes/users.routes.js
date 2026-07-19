/**
 * users.routes.js
 *
 * All API routes for the main MeetFlow backend.
 * Node.js is the ONLY backend — no FastAPI, no Python scheduler.
 *
 * Route groups:
 *   /api/v1/users/*         — auth + meeting history + AI features (existing)
 *   /api/auth/google/*      — Google OAuth2 (migrated from scheduler)
 *   /api/calendar/*         — Google Calendar meeting management (migrated from scheduler)
 */

import { Router } from "express";

// ── Existing controllers ──────────────────────────────────────────────────────
import {
  login,
  register,
  getUserHistory,
  addToHistory,
  sendInvitation,
} from "../controllers/user.controller.js";

import {
  getMeetingSummary,
  getMeetingTasks,
  updateTask,
  deleteTask,
  getMeetingAnalytics,
  askMeeting,
  triggerAIProcessing,
  smartSearch,
  getDashboardInsights,
  createScheduledMeeting,
  checkMeeting,
  validateMeetingPassword,
  updateMeetingSettings,
} from "../controllers/ai.controller.js";

// ── New controllers (migrated from Python scheduler) ─────────────────────────
import {
  getGoogleOAuthUrl,
  handleGoogleCallback,
  getGoogleConnectionStatus,
  disconnectGoogle,
} from "../controllers/googleAuth.controller.js";

import {
  createCalendarMeeting,
  listCalendarMeetings,
  getCalendarMeeting,
  rescheduleMeeting,
  cancelCalendarMeeting,
  addAttendees,
  removeAttendees,
  resendInvitations,
  syncRsvp,
  getUpcomingEvents,
} from "../controllers/calendar.controller.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// AUTH (existing token-based auth)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/v1/users/login",    login);
router.post("/api/v1/users/register", register);

// ─────────────────────────────────────────────────────────────────────────────
// MEETING HISTORY (existing)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/v1/users/add_to_activity", addToHistory);
router.get("/api/v1/users/get_all_activity", getUserHistory);

// ─────────────────────────────────────────────────────────────────────────────
// INVITATIONS (existing simple email invite)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/v1/users/send-invitation", sendInvitation);

// ─────────────────────────────────────────────────────────────────────────────
// MEETING LIFECYCLE (existing Node.js flow — instant / scheduled without Calendar)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/v1/users/create-scheduled-meeting",     createScheduledMeeting);
router.get("/api/v1/users/check-meeting/:meetingCode",    checkMeeting);
router.post("/api/v1/users/validate-meeting-password",    validateMeetingPassword);
router.post("/api/v1/users/update-meeting-settings",      updateMeetingSettings);

// ─────────────────────────────────────────────────────────────────────────────
// AI FEATURES (existing)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/v1/users/meeting-summary",               getMeetingSummary);
router.get("/api/v1/users/meeting-tasks",                 getMeetingTasks);
router.put("/api/v1/users/meeting-tasks/:taskId",         updateTask);
router.delete("/api/v1/users/meeting-tasks/:taskId",      deleteTask);
router.get("/api/v1/users/meeting-analytics",             getMeetingAnalytics);
router.post("/api/v1/users/meeting-assistant",            askMeeting);
router.post("/api/v1/users/trigger-ai",                   triggerAIProcessing);
router.get("/api/v1/users/smart-search",                  smartSearch);
router.get("/api/v1/users/dashboard-insights",            getDashboardInsights);

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH (migrated from Python scheduler /api/auth/*)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/auth/google/url",         getGoogleOAuthUrl);
router.post("/api/auth/google/callback",   handleGoogleCallback);
router.get("/api/auth/google/status",      getGoogleConnectionStatus);
router.post("/api/auth/google/disconnect", disconnectGoogle);

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR MEETINGS (migrated from Python scheduler /api/meetings/*)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/calendar/create",                                  createCalendarMeeting);
router.get("/api/calendar/events",                                   listCalendarMeetings);
router.get("/api/calendar/events/:meetingCode",                      getCalendarMeeting);
router.put("/api/calendar/events/:meetingCode/reschedule",           rescheduleMeeting);
router.delete("/api/calendar/events/:meetingCode",                   cancelCalendarMeeting);
router.post("/api/calendar/events/:meetingCode/attendees",           addAttendees);
router.delete("/api/calendar/events/:meetingCode/attendees",         removeAttendees);
router.post("/api/calendar/events/:meetingCode/resend-invitation",   resendInvitations);
router.post("/api/calendar/sync-rsvp/:meetingCode",                  syncRsvp);
router.get("/api/calendar/upcoming",                                 getUpcomingEvents);

export default router;
