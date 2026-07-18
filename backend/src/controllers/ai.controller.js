import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { Transcript } from "../models/transcript.model.js";
import { Task } from "../models/task.model.js";
import { Summary } from "../models/summary.model.js";
import { Analytics } from "../models/analytics.model.js";

import { answerMeetingQuestion } from "../services/meetingAssistantService.js";
import { generateSummary } from "../services/summaryService.js";
import { extractTasks } from "../services/taskExtractionService.js";
import { generateAnalytics } from "../services/analyticsService.js";
import { getFullTranscriptText } from "../services/transcriptionService.js";

// Helper to authenticate user by token
const getUserByToken = async (token) => {
  if (!token) return null;
  return await User.findOne({ token });
};

export const getMeetingSummary = async (req, res) => {
  const { meetingCode } = req.query;
  try {
    let summary = await Summary.findOne({ meetingCode });
    if (!summary) {
      // Try to generate on the fly if transcripts exist
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
    return res.status(httpStatus.OK).json({ message: "Task deleted successfully" });
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
      return res.status(400).json({ message: "No transcripts found for this meeting" });
    }
    const summary = await generateSummary(meetingCode, fullText);
    const tasks = await extractTasks(meetingCode, fullText);
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

    // Find all meeting codes for this user
    const userMeetings = await Meeting.find({ user_id: user.username });
    const meetingCodes = userMeetings.map((m) => m.meetingCode);

    // Search query in transcripts matching user's meetings
    const results = await Transcript.find({
      meetingCode: { $in: meetingCodes },
      text: { $regex: query, $options: "i" }
    }).sort({ timestamp: -1 }).limit(30);

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

    // Fetch analytics for all meetings
    const analyticsRecords = await Analytics.find({ meetingCode: { $in: meetingCodes } });
    const tasks = await Task.find({ meetingCode: { $in: meetingCodes } });

    // Aggregate scores
    let sumMeetingScore = 0;
    let sumParticipationScore = 0;
    let sentimentCount = {};
    let topicCount = {};

    analyticsRecords.forEach((a) => {
      sumMeetingScore += a.meetingScore || 0;
      sumParticipationScore += a.participationScore || 0;
      if (a.sentimentTrend) {
        a.sentimentTrend.forEach((s) => {
          sentimentCount[s] = (sentimentCount[s] || 0) + 1;
        });
      }
      if (a.frequentlyDiscussed) {
        a.frequentlyDiscussed.forEach((t) => {
          topicCount[t] = (topicCount[t] || 0) + 1;
        });
      }
    });

    const averageMeetingScore = totalMeetings > 0 ? Math.round(sumMeetingScore / totalMeetings) : 0;
    const averageParticipationScore = totalMeetings > 0 ? Math.round(sumParticipationScore / totalMeetings) : 0;

    // Tasks details
    const tasksCreated = tasks.length;
    const completedTasks = tasks.filter((t) => t.completed).length;
    const pendingTasks = tasksCreated - completedTasks;

    return res.status(httpStatus.OK).json({
      averageMeetingScore,
      averageParticipationScore,
      sentimentTrend: Object.entries(sentimentCount).map(([name, value]) => ({ name, value })),
      tasksCreated,
      deadlinesPending: pendingTasks,
      completedTasks,
      frequentlyDiscussedTopics: Object.entries(topicCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createScheduledMeeting = async (req, res) => {
  const { token, expiresAtChoice, password, waitingRoomEnabled, meetingTitle, description } = req.body;
  try {
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let meetingCode = '';
    for (let i = 0; i < 9; i++) {
      meetingCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    let expiresAt = null;
    if (expiresAtChoice && expiresAtChoice !== "never") {
      const now = new Date();
      if (expiresAtChoice === "30m") expiresAt = new Date(now.getTime() + 30 * 60000);
      else if (expiresAtChoice === "1h") expiresAt = new Date(now.getTime() + 60 * 60000);
      else if (expiresAtChoice === "2h") expiresAt = new Date(now.getTime() + 120 * 60000);
      else if (expiresAtChoice === "6h") expiresAt = new Date(now.getTime() + 360 * 60000);
      else if (expiresAtChoice === "24h") expiresAt = new Date(now.getTime() + 1440 * 60000);
      else if (expiresAtChoice.startsWith("custom:")) {
        expiresAt = new Date(expiresAtChoice.substring(7));
      } else {
        expiresAt = new Date(expiresAtChoice);
      }
    }

    const hostHeader = req.headers.host || "localhost:3000";
    const meetingLink = `http://${hostHeader}/meeting/${meetingCode}`;

    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode: meetingCode,
      hostId: user.username,
      expiresAt: expiresAt,
      meetingPassword: password || undefined,
      waitingRoomEnabled: !!waitingRoomEnabled,
      status: "ACTIVE",
      meetingId: meetingCode,
      meetingLink: meetingLink,
      meetingTitle: meetingTitle || "MeetFlow AI Call",
      description: description || "",
      password: password || undefined,
      createdAt: new Date()
    });

    await newMeeting.save();
    return res.status(httpStatus.CREATED).json(newMeeting);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const checkMeeting = async (req, res) => {
  const { meetingCode } = req.params;
  try {
    let meeting = await Meeting.findOne({ meetingCode });
    
    // If meeting doesn't exist in DB (e.g. someone joined via invite link before host registered it),
    // auto-create a permissive guest record so invited candidates are not blocked
    if (!meeting) {
      meeting = new Meeting({
        meetingCode: meetingCode,
        meetingId: meetingCode,
        hostId: null,  // No fixed host - first person to claim can become host
        status: "ACTIVE",
        waitingRoomEnabled: false,
        isLocked: false,
        isChatDisabled: false,
        isScreenShareDisabled: false,
        isMutedAll: false,
        createdAt: new Date(),
      });
      await meeting.save();
    }

    if (meeting.expiresAt && new Date() > new Date(meeting.expiresAt)) {
      meeting.status = "EXPIRED";
      await meeting.save();
    }

    return res.status(200).json({
      meetingCode: meeting.meetingCode,
      hostId: meeting.hostId,
      status: meeting.status,
      passwordRequired: !!meeting.meetingPassword,
      waitingRoomEnabled: meeting.waitingRoomEnabled,
      isLocked: meeting.isLocked,
      isChatDisabled: meeting.isChatDisabled,
      isScreenShareDisabled: meeting.isScreenShareDisabled,
      isMutedAll: meeting.isMutedAll,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const validateMeetingPassword = async (req, res) => {
  const { meetingCode, password } = req.body;
  try {
    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.meetingPassword === password) {
      return res.status(200).json({ valid: true });
    } else {
      return res.status(400).json({ valid: false, message: "Invalid meeting password" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateMeetingSettings = async (req, res) => {
  const { meetingCode, token, settings } = req.body;
  try {
    const user = await getUserByToken(token);
    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.hostId !== user?.username) {
      return res.status(403).json({ message: "Only host can update settings" });
    }

    if (settings.waitingRoomEnabled !== undefined) meeting.waitingRoomEnabled = settings.waitingRoomEnabled;
    if (settings.isLocked !== undefined) meeting.isLocked = settings.isLocked;
    if (settings.isChatDisabled !== undefined) meeting.isChatDisabled = settings.isChatDisabled;
    if (settings.isScreenShareDisabled !== undefined) meeting.isScreenShareDisabled = settings.isScreenShareDisabled;
    if (settings.isMutedAll !== undefined) meeting.isMutedAll = settings.isMutedAll;

    await meeting.save();
    return res.status(200).json(meeting);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
