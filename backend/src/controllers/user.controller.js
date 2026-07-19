import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../services/emailService.js";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Please provide username and password" });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
    }
    const token = crypto.randomBytes(20).toString("hex");
    user.token = token;
    await user.save();
    // Return token AND userId so the frontend can use userId for host comparison
    return res.status(httpStatus.OK).json({
      token,
      userId: user._id.toString(),
      username: user.username,
      name: user.name
    });
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

const register = async (req, res) => {
  const { name, username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(httpStatus.FOUND).json({ message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, username, password: hashedPassword });
    await newUser.save();
    return res.status(httpStatus.CREATED).json({ message: "User registered successfully" });
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

// ---------------------------------------------------------------------------
// Meeting history
// ---------------------------------------------------------------------------

const getUserHistory = async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const meetings = await Meeting.find({ user_id: user.username }).sort({ date: -1 });
    return res.json(meetings);
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

const addToHistory = async (req, res) => {
  const { token, meeting_code } = req.body;
  try {
    const user = await User.findOne({ token });
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Only add to history if not already present for this user
    const exists = await Meeting.findOne({ user_id: user.username, meetingCode: meeting_code });
    if (!exists) {
      const newEntry = new Meeting({
        user_id: user.username,
        meetingCode: meeting_code,
        hostId: user._id.toString(), // default host to the user adding history
        createdBy: user.username,
        meetingStatus: "ACTIVE"
      });
      await newEntry.save();
    }
    return res.status(httpStatus.CREATED).json({ message: "Added to history" });
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

// ---------------------------------------------------------------------------
// Email invitation (simple, no Google Calendar)
// ---------------------------------------------------------------------------

const sendInvitation = async (req, res) => {
  const { emails, meetingCode, senderName, isGroupEmail } = req.body;
  if (!emails || !meetingCode) {
    return res.status(400).json({ message: "Missing required fields: emails and meetingCode" });
  }

  let emailArray = [];
  if (Array.isArray(emails)) {
    emails.forEach((e) => {
      if (typeof e === "string") {
        emailArray.push(...e.split(",").map((s) => s.trim()).filter(Boolean));
      }
    });
  } else if (typeof emails === "string") {
    emailArray = emails.split(",").map((s) => s.trim()).filter(Boolean);
  }
  emailArray = [...new Set(emailArray)];

  if (emailArray.length === 0) {
    return res.status(400).json({ message: "No valid emails provided" });
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const joinUrl = `${frontendUrl}/meeting/${meetingCode}`;
  const subject = `${senderName || "Someone"} is inviting you to a MeetFlow meeting`;
  const html = `
    <div style="font-family:sans-serif;padding:20px;color:#333;max-width:600px;margin:auto;border:1px solid #eee;border-radius:8px;">
      <h2 style="color:#018CCB;text-align:center;">Join MeetFlow Meeting</h2>
      <p>Hello,</p>
      <p><strong>${senderName || "A user"}</strong> has invited you to join a video meeting on MeetFlow.</p>
      <p><strong>Meeting Code:</strong> <code style="background:#f4f4f4;padding:4px 8px;border-radius:4px;">${meetingCode}</code></p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${joinUrl}" style="background-color:#018CCB;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Join Meeting Now</a>
      </div>
      <p style="font-size:13px;color:#666;">Or copy this link:<br/><a href="${joinUrl}">${joinUrl}</a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
      <p style="font-size:12px;color:#999;text-align:center;">This is an automated invitation from MeetFlow.</p>
    </div>
  `;

  try {
    let previewUrl = null;
    if (isGroupEmail) {
      const result = await sendEmail({ to: emailArray.join(", "), subject, html });
      if (result.previewUrl) previewUrl = result.previewUrl;
    } else {
      for (const email of emailArray) {
        const result = await sendEmail({ to: email, subject, html });
        if (result.previewUrl) previewUrl = result.previewUrl;
      }
    }
    return res.status(httpStatus.OK).json({
      message: isGroupEmail ? "Group invitation sent" : "Individual invitations sent",
      previewUrl
    });
  } catch (error) {
    return res.status(500).json({ message: `Failed to send email: ${error.message}` });
  }
};

export { login, register, getUserHistory, addToHistory, sendInvitation };
