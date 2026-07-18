import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt, { hash } from "bcrypt";
import crypto from "crypto";
import { Meeting } from "../models/meeting.model.js";
import { sendEmail } from "../services/emailService.js";
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Please Provide" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User Not Found" });
    }

    let isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (isPasswordCorrect) {
      let token = crypto.randomBytes(20).toString("hex");

      user.token = token;
      await user.save();
      return res.status(httpStatus.OK).json({ token: token });
    } else {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid Username or password" });
    }
  } catch (e) {
    return res.status(500).json({ message: `Something went wrong ${e}` });
  }
};

const register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(httpStatus.FOUND)
        .json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: name,
      username: username,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(httpStatus.CREATED).json({ message: "User Registered" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const getUserHistory = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ token: token });
    const meetings = await Meeting.find({ user_id: user.username });
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const { token, meeting_code } = req.body;

  try {
    const user = await User.findOne({ token: token });

    const newMeeting = new Meeting({
      user_id: user.username,
      meetingCode: meeting_code,
    });

    await newMeeting.save();

    res.status(httpStatus.CREATED).json({ message: "Added code to history" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const sendInvitation = async (req, res) => {
  const { emails, meetingCode, senderName, isGroupEmail } = req.body;

  if (!emails || !meetingCode) {
    return res.status(400).json({ message: "Missing required fields: emails and meetingCode" });
  }

  // Ensure emails is an array and flatten any comma-separated strings inside it
  let emailArray = [];
  if (Array.isArray(emails)) {
    emails.forEach(e => {
       if (typeof e === 'string') {
         emailArray.push(...e.split(',').map(str => str.trim()).filter(str => str));
       }
    });
  } else if (typeof emails === 'string') {
    emailArray = emails.split(',').map(str => str.trim()).filter(str => str);
  }

  // Deduplicate emails
  emailArray = [...new Set(emailArray)];

  if (emailArray.length === 0) {
    return res.status(400).json({ message: "No valid emails provided" });
  }

  const joinUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/${meetingCode}`;
  const subject = `${senderName || "Someone"} is inviting you to join a MeetFlow meeting`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #018CCB; text-align: center;">Join MeetFlow Meeting</h2>
      <p>Hello,</p>
      <p><strong>${senderName || "A user"}</strong> has invited you to join a video meeting on MeetFlow.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinUrl}" style="background-color: #018CCB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Join Meeting Now</a>
      </div>
      <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:<br/><a href="${joinUrl}">${joinUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated invitation from MeetFlow.</p>
    </div>
  `;

  try {
    let previewUrl = null;
    
    if (isGroupEmail) {
      // Send as one group email (everyone sees each other in the To field)
      const groupRecipients = emailArray.join(", ");
      const result = await sendEmail({ to: groupRecipients, subject, html });
      if (result.previewUrl) previewUrl = result.previewUrl;
    } else {
      // Send individual emails to avoid SMTP grouping/spam issues
      for (const email of emailArray) {
        const result = await sendEmail({ to: email, subject, html });
        if (result.previewUrl) previewUrl = result.previewUrl;
      }
    }

    return res.status(httpStatus.OK).json({ 
      message: isGroupEmail ? "Group invitation sent successfully" : "Individual invitations sent successfully", 
      previewUrl: previewUrl 
    });
  } catch (error) {
    return res.status(500).json({ message: `Failed to send email: ${error.message}` });
  }
};

export { login, register, getUserHistory, addToHistory, sendInvitation };
