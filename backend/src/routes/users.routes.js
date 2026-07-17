import { Router } from "express";
import {
  addToHistory,
  getUserHistory,
  login,
  register,
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
  updateMeetingSettings
} from "../controllers/ai.controller.js";

const router = Router();

// Existing Auth routes
router.route("/login").post(login);
router.route("/register").post(register);
router.route("/add_to_activity").post(addToHistory);
router.route("/get_all_activity").get(getUserHistory);
router.route("/send-invitation").post(sendInvitation);

// New AI & Google Meet routes
router.route("/meeting-summary").get(getMeetingSummary);
router.route("/meeting-tasks").get(getMeetingTasks);
router.route("/meeting-tasks/:taskId").put(updateTask).delete(deleteTask);
router.route("/meeting-analytics").get(getMeetingAnalytics);
router.route("/meeting-assistant").post(askMeeting);
router.route("/trigger-ai").post(triggerAIProcessing);
router.route("/smart-search").get(smartSearch);
router.route("/dashboard-insights").get(getDashboardInsights);

router.route("/create-scheduled-meeting").post(createScheduledMeeting);
router.route("/check-meeting/:meetingCode").get(checkMeeting);
router.route("/validate-meeting-password").post(validateMeetingPassword);
router.route("/update-meeting-settings").post(updateMeetingSettings);

export default router;
