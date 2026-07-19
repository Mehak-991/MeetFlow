/**
 * ai.controller.js
 * 
 * Handles all meeting management, AI features, and analytics.
 * Node.js is the SINGLE backend — no FastAPI, no SQLAlchemy.
 * MongoDB is the Single Source of Truth.
 * 
 * Host detection: meeting.hostId === loggedInUser._id.toString()
 */

import httpStatus from "http-status";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { Transcript } from "../models/transcript.model.js";
import { Task } from "../models/task.model.js";
import { Summary } from "../models/summary.model.js";
import { Analytics } from "../models/analytics.model.js";
import { sendEmail } from "../services/emailService.js";

import { answerMeetingQuestion } from "../services/meetingAssistantService.js";
import { generateSummary } from "../services/summaryService.js";
import { extractTasks } from "../services/taskExtractionService.js";
import { generateAnalytics } from "../services/analyticsService.js";
import { getFullTranscriptText } from "../services/transcriptionService.js";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

const getUserByToken = async (token) => {
  if (!token) return null;
  return await User.findOne({ token });
};

// ---------------------------------------------------------------------------
// Meeting creation — MongoDB is the source of truth
// ---------------------------------------------------------------------------

export const createScheduledMeeting = async (req, res) => {
  const {
    token,
    expiresAtChoice,
    password,
    waitingRoomEnabled,
    meetingTitle,
    description,
    attendeeEmails,   // optional: array of email addresses to invite
    sendCalendarInvite // optional: boolean
  } = req.body;

  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Generate a unique 9-character alphanumeric meeting code
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let meetingCode = "";
    for (let i = 0; i < 9; i++) {
      meetingCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Parse expiry
    let expiresAt = null;
    if (expiresAtChoice && expiresAtChoice !== "never") {
      const now = new Date();
      if      (expiresAtChoice === "30m")  expiresAt = new Date(now.getTime() + 30 * 60000);
      else if (expiresAtChoice === "1h")   expiresAt = new Date(now.getTime() + 60 * 60000);
      else if (expiresAtChoice === "2h")   expiresAt = new Date(now.getTime() + 120 * 60000);
      else if (expiresAtChoice === "6h")   expiresAt = new Date(now.getTime() + 360 * 60000);
      else if (expiresAtChoice === "24h")  expiresAt = new Date(now.getTime() + 1440 * 60000);
      else {
        // Custom datetime string
        const parsed = new Date(expiresAtChoice);
        if (!isNaN(parsed)) expiresAt = parsed;
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const meetingLink = `${frontendUrl}/meeting/${meetingCode}`;

    // Normalize attendees list
    let attendees = [];
    if (Array.isArray(attendeeEmails)) {
      attendees = attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    } else if (typeof attendeeEmails === "string" && attendeeEmails.trim()) {
      attendees = attendeeEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    }

    // Save meeting in MongoDB — hostId is user._id (ObjectId as string)
    const newMeeting = new Meeting({
      meetingCode,
      meetingLink,
      meetingTitle: meetingTitle || "MeetFlow Meeting",
      description: description || "",
      hostId: user._id.toString(),           // CRITICAL: use _id, not username
      createdBy: user.username,
      organizerEmail: user.email || user.username,
      attendees,
      meetingPassword: password || null,
      waitingRoomEnabled: !!waitingRoomEnabled,
      meetingStatus: "ACTIVE",
      expiresAt,
      user_id: user.username,               // backward compat for history lookup
      date: new Date(),
      createdAt: new Date()
    });

    await newMeeting.save();

    // Auto-send invitation emails if attendees provided
    if (attendees.length > 0) {
      const subject = `${user.name || user.username} invited you to a MeetFlow meeting`;
      const html = buildInviteEmail(user.name || user.username, meetingCode, meetingLink, newMeeting.meetingTitle);
      for (const email of attendees) {
        sendEmail({ to: email, subject, html }).catch((err) => {
          console.error(`Failed to send invite to ${email}:`, err.message);
        });
      }
    }

    return res.status(httpStatus.CREATED).json({
      meetingCode: newMeeting.meetingCode,
      meetingLink: newMeeting.meetingLink,
      meetingTitle: newMeeting.meetingTitle,
      hostId: newMeeting.hostId,
      expiresAt: newMeeting.expiresAt,
      waitingRoomEnabled: newMeeting.waitingRoomEnabled,
      attendees: newMeeting.attendees,
      meetingPassword: newMeeting.meetingPassword ? "[protected]" : null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Meeting validation — used by frontend before joining
// ---------------------------------------------------------------------------

/**
 * GET /check-meeting/:meetingCode
 * 
 * Returns meeting metadata so frontend can:
 *  - Show password prompt if needed
 *  - Show expired screen
 *  - Determine if current user is host (by comparing hostId with stored userId)
 *  - Decide whether to show waiting room
 */
export const checkMeeting = async (req, res) => {
  const { meetingCode } = req.params;
  const { token } = req.query;

  try {
    const meeting = await Meeting.findOne({ meetingCode });

    if (!meeting) {
      return res.status(404).json({
        error: "MEETING_NOT_FOUND",
        message: "Meeting not found. The link may be invalid."
      });
    }

    // Check expiry
    if (meeting.expiresAt && new Date() > new Date(meeting.expiresAt)) {
      if (meeting.meetingStatus !== "EXPIRED") {
        meeting.meetingStatus = "EXPIRED";
        await meeting.save();
      }
      return res.status(410).json({
        error: "MEETING_EXPIRED",
        message: "This meeting has expired.",
        status: "EXPIRED"
      });
    }

    if (meeting.meetingStatus === "ENDED") {
      return res.status(410).json({
        error: "MEETING_ENDED",
        message: "This meeting has been ended by the host.",
        status: "ENDED"
      });
    }

    // Determine if requesting user is the host
    let isHost = false;
    let userId = null;
    if (token) {
      const user = await getUserByToken(token);
      if (user) {
        userId = user._id.toString();
        isHost = meeting.hostId === userId; // CORRECT: _id comparison
      }
    }

    // If meeting is locked and user is not host, deny
    if (meeting.isLocked && !isHost) {
      return res.status(403).json({
        error: "MEETING_LOCKED",
        message: "This meeting has been locked by the host.",
        status: "LOCKED"
      });
    }

    return res.status(200).json({
      meetingCode: meeting.meetingCode,
      meetingTitle: meeting.meetingTitle,
      hostId: meeting.hostId,
      status: meeting.meetingStatus,
      isHost,
      passwordRequired: !!meeting.meetingPassword,
      waitingRoomEnabled: meeting.waitingRoomEnabled,
      isLocked: meeting.isLocked,
      isChatDisabled: meeting.isChatDisabled,
      isScreenShareDisabled: meeting.isScreenShareDisabled,
      isMutedAll: meeting.isMutedAll,
      attendees: meeting.attendees,
      googleMeetLink: meeting.googleMeetLink || null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /validate-meeting-password
 */
export const validateMeetingPassword = async (req, res) => {
  const { meetingCode, password } = req.body;
  try {
    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }
    if (meeting.meetingPassword === password) {
      return res.status(200).json({ valid: true });
    }
    return res.status(400).json({ valid: false, message: "Incorrect meeting password" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /update-meeting-settings
 * Only the host (matched by _id) can update settings.
 */
export const updateMeetingSettings = async (req, res) => {
  const { meetingCode, token, settings } = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.hostId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the host can update meeting settings" });
    }

    if (settings.waitingRoomEnabled !== undefined) meeting.waitingRoomEnabled = settings.waitingRoomEnabled;
    if (settings.isLocked !== undefined)           meeting.isLocked = settings.isLocked;
    if (settings.isChatDisabled !== undefined)     meeting.isChatDisabled = settings.isChatDisabled;
    if (settings.isScreenShareDisabled !== undefined) meeting.isScreenShareDisabled = settings.isScreenShareDisabled;
    if (settings.isMutedAll !== undefined)         meeting.isMutedAll = settings.isMutedAll;

    await meeting.save();
    return res.status(200).json({ message: "Settings updated", meeting });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// AI Features
// ---------------------------------------------------------------------------

export const getMeetingSummary = async (req, res) => {
  const { meetingCode } = req.query;
  try {
    let summary = await Summary.findOne({ meetingCode });
    if (!summary) {
      const fullText = await getFullTranscriptText(meetingCode);
      if (fullText && fullText.trim() !== "") {
        summary = await generateSummary(meetingCode, fullText);
      }
    }
    return res.status(httpStatus.OK).json(summary || { message: "No summary generated yet." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMeetingTasks = async (req, res) => {
  const { meetingCode } = req.query;
  try {
    let tasks = await Task.find({ meetingCode });
    if (tasks.length === 0) {
      const fullText = await getFullTranscriptText(meetingCode);
      if (fullText && fullText.trim() !== "") {
        tasks = await extractTasks(meetingCode, fullText);
      }
    }
    return res.status(httpStatus.OK).json(tasks);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  const { taskId } = req.params;
  const { task, assignedTo, deadline, completed } = req.body;
  try {
    const updated = await Task.findByIdAndUpdate(
      taskId,
      { task, assignedTo, deadline, completed },
      { new: true }
    );
    return res.status(httpStatus.OK).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    await Task.findByIdAndDelete(taskId);
    return res.status(httpStatus.OK).json({ message: "Task deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMeetingAnalytics = async (req, res) => {
  const { meetingCode } = req.query;
  try {
    let analytics = await Analytics.findOne({ meetingCode });
    if (!analytics) {
      const transcripts = await Transcript.find({ meetingCode });
      if (transcripts.length > 0) {
        analytics = await generateAnalytics(meetingCode);
      }
    }
    return res.status(httpStatus.OK).json(analytics || {});
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const askMeeting = async (req, res) => {
  const { meetingCode, question } = req.body;
  if (!meetingCode || !question) {
    return res.status(400).json({ message: "meetingCode and question are required" });
  }
  try {
    const answer = await answerMeetingQuestion(meetingCode, question);
    return res.status(httpStatus.OK).json({ answer });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const triggerAIProcessing = async (req, res) => {
  const { meetingCode } = req.body;
  try {
    const fullText = await getFullTranscriptText(meetingCode);
    if (!fullText || fullText.trim() === "") {
      return res.status(400).json({ message: "No transcript found for this meeting" });
    }
    const summary   = await generateSummary(meetingCode, fullText);
    const tasks     = await extractTasks(meetingCode, fullText);
    const analytics = await generateAnalytics(meetingCode);
    return res.status(httpStatus.OK).json({ summary, tasks, analytics });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const smartSearch = async (req, res) => {
  const { token, query } = req.query;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const userMeetings = await Meeting.find({ user_id: user.username });
    const meetingCodes = userMeetings.map((m) => m.meetingCode);

    const results = await Transcript.find({
      meetingCode: { $in: meetingCodes },
      text: { $regex: query, $options: "i" }
    })
      .sort({ timestamp: -1 })
      .limit(30);

    return res.status(httpStatus.OK).json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDashboardInsights = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const userMeetings = await Meeting.find({ user_id: user.username });
    const meetingCodes = userMeetings.map((m) => m.meetingCode);
    const totalMeetings = meetingCodes.length;

    const analyticsRecords = await Analytics.find({ meetingCode: { $in: meetingCodes } });
    const tasks            = await Task.find({ meetingCode: { $in: meetingCodes } });

    let sumMeetingScore      = 0;
    let sumParticipationScore = 0;
    const sentimentCount     = {};
    const topicCount         = {};

    analyticsRecords.forEach((a) => {
      sumMeetingScore      += a.meetingScore || 0;
      sumParticipationScore += a.participationScore || 0;
      (a.sentimentTrend || []).forEach((s) => {
        sentimentCount[s] = (sentimentCount[s] || 0) + 1;
      });
      (a.frequentlyDiscussed || []).forEach((t) => {
        topicCount[t] = (topicCount[t] || 0) + 1;
      });
    });

    return res.status(httpStatus.OK).json({
      averageMeetingScore:       totalMeetings > 0 ? Math.round(sumMeetingScore / totalMeetings) : 0,
      averageParticipationScore: totalMeetings > 0 ? Math.round(sumParticipationScore / totalMeetings) : 0,
      sentimentTrend: Object.entries(sentimentCount).map(([name, value]) => ({ name, value })),
      tasksCreated:     tasks.length,
      deadlinesPending: tasks.filter((t) => !t.completed).length,
      completedTasks:   tasks.filter((t) => t.completed).length,
      frequentlyDiscussedTopics: Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Helper: build invitation email HTML
// ---------------------------------------------------------------------------

function buildInviteEmail(senderName, meetingCode, meetingLink, meetingTitle) {
  return `
    <div style="font-family:sans-serif;padding:20px;color:#333;max-width:600px;margin:auto;border:1px solid #eee;border-radius:8px;">
      <h2 style="color:#018CCB;text-align:center;">MeetFlow Meeting Invitation</h2>
      <p>Hello,</p>
      <p><strong>${senderName}</strong> has invited you to join a meeting: <strong>${meetingTitle || "MeetFlow Meeting"}</strong>.</p>
      <p><strong>Meeting Code:</strong> <code style="background:#f4f4f4;padding:4px 8px;border-radius:4px;">${meetingCode}</code></p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${meetingLink}" style="background-color:#018CCB;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;">Join Meeting</a>
      </div>
      <p style="font-size:13px;color:#666;">Or paste: <a href="${meetingLink}">${meetingLink}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
      <p style="font-size:12px;color:#999;text-align:center;">Sent via MeetFlow</p>
    </div>
  `;
}
