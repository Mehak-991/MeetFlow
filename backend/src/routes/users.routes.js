import { Router } from "express";
import {
  login,
  register,
  getUserHistory,
  addToHistory,
  sendInvitation
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
  updateMeetingSettings
} from "../controllers/ai.controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
router.post("/login",    login);
router.post("/register", register);

// ---------------------------------------------------------------------------
// Meeting history
// ---------------------------------------------------------------------------
router.post("/add_to_activity", addToHistory);
router.get("/get_all_activity", getUserHistory);

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
router.post("/send-invitation", sendInvitation);

// ---------------------------------------------------------------------------
// Meeting lifecycle (Node.js is the ONLY backend)
// ---------------------------------------------------------------------------
router.post("/create-scheduled-meeting",     createScheduledMeeting);
router.get("/check-meeting/:meetingCode",    checkMeeting);
router.post("/validate-meeting-password",    validateMeetingPassword);
router.post("/update-meeting-settings",      updateMeetingSettings);

// ---------------------------------------------------------------------------
// AI features
// ---------------------------------------------------------------------------
router.get("/meeting-summary",               getMeetingSummary);
router.get("/meeting-tasks",                 getMeetingTasks);
router.put("/meeting-tasks/:taskId",         updateTask);
router.delete("/meeting-tasks/:taskId",      deleteTask);
router.get("/meeting-analytics",             getMeetingAnalytics);
router.post("/meeting-assistant",            askMeeting);
router.post("/trigger-ai",                   triggerAIProcessing);
router.get("/smart-search",                  smartSearch);
router.get("/dashboard-insights",            getDashboardInsights);

export default router;
