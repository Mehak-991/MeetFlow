/**
 * socketManager.js
 * 
 * WebRTC signaling, chat, transcription, waiting room, host permissions.
 * 
 * HOST DETECTION: meeting.hostId === socket.userId
 *   - userId is the MongoDB User._id (string), sent from frontend on join-call.
 *   - Never compare by username string for host checks.
 * 
 * Socket join flow:
 *   1. Client emits "join-call" with { path, username, userId }
 *   2. Server loads meeting from MongoDB
 *   3. Verifies meeting exists and is ACTIVE
 *   4. Compares userId with meeting.hostId to determine host
 *   5. If waitingRoom enabled and not host → put in lobby
 *   6. Otherwise → admit to WebRTC room
 */

import { Server } from "socket.io";
import { Transcript } from "../models/transcript.model.js";
import { Meeting } from "../models/meeting.model.js";
import { saveTranscriptSegment, getFullTranscriptText } from "../services/transcriptionService.js";
import { generateSummary } from "../services/summaryService.js";
import { extractTasks } from "../services/taskExtractionService.js";
import { generateAnalytics } from "../services/analyticsService.js";

// In-memory state (per server instance)
let connections   = {};    // { [meetingCode]: [socketId, ...] }
let messages      = {};    // { [meetingCode]: [{sender, data, socket-id-sender}] }
let timeOnline    = {};    // { [socketId]: Date }
let waitingLobbies = {};   // { [meetingCode]: [{socketId, username, userId}] }
let hostSockets    = {};   // { [meetingCode]: [socketId, ...] }

// Per-socket metadata
let socketMeta = {};       // { [socketId]: { username, userId, meetingCode } }

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ------------------------------------------------------------------
    // join-call: authenticate + load meeting + route to lobby or room
    // ------------------------------------------------------------------
    socket.on("join-call", async (path, username, userId) => {
      // Extract meetingCode from path (handles /meeting/CODE or /CODE)
      const pathParts = path.split("/");
      const meetingCode = pathParts[pathParts.length - 1];

      socketMeta[socket.id] = { username, userId, meetingCode };

      try {
        const meeting = await Meeting.findOne({ meetingCode });

        if (!meeting) {
          socket.emit("error-message", "Meeting not found.");
          return;
        }

        if (meeting.meetingStatus === "EXPIRED" || meeting.meetingStatus === "ENDED") {
          socket.emit("error-message", `Meeting is ${meeting.meetingStatus.toLowerCase()}.`);
          return;
        }

        // Correct host check: compare MongoDB _id (as string)
        const isHost = !!userId && meeting.hostId === userId;

        if (isHost) {
          if (!hostSockets[meetingCode]) hostSockets[meetingCode] = [];
          hostSockets[meetingCode].push(socket.id);
        }

        // Waiting room check: applies to guests only
        if (meeting.waitingRoomEnabled && !isHost) {
          if (!waitingLobbies[meetingCode]) waitingLobbies[meetingCode] = [];
          waitingLobbies[meetingCode].push({ socketId: socket.id, username, userId });

          socket.emit("waiting-room-joined");

          // Notify host(s) about updated waiting list
          broadcastToHosts(io, meetingCode, "waiting-room-list", waitingLobbies[meetingCode]);
          return;
        }

        // Admit directly
        await admitParticipant(io, socket, meetingCode, username);
      } catch (err) {
        console.error("[Socket] join-call error:", err);
        socket.emit("error-message", "Failed to join meeting. Please try again.");
      }
    });

    // ------------------------------------------------------------------
    // Host waiting room decisions
    // ------------------------------------------------------------------
    socket.on("host-decision", async (meetingCode, participantSocketId, approved) => {
      if (!isSocketHost(socket.id, meetingCode)) {
        return socket.emit("error-message", "Only the host can manage the waiting room.");
      }

      if (!waitingLobbies[meetingCode]) return;

      const idx = waitingLobbies[meetingCode].findIndex(
        (p) => p.socketId === participantSocketId
      );
      if (idx === -1) return;

      const participant = waitingLobbies[meetingCode].splice(idx, 1)[0];
      broadcastToHosts(io, meetingCode, "waiting-room-list", waitingLobbies[meetingCode]);

      const pSocket = io.sockets.sockets.get(participantSocketId);
      if (approved) {
        if (pSocket) {
          pSocket.emit("lobby-approved");
          await admitParticipant(io, pSocket, meetingCode, participant.username);
        }
      } else {
        if (pSocket) {
          pSocket.emit("lobby-rejected");
          pSocket.disconnect();
        }
      }
    });

    socket.on("approve-all", async (meetingCode) => {
      if (!isSocketHost(socket.id, meetingCode)) return;

      const queue = waitingLobbies[meetingCode] ? [...waitingLobbies[meetingCode]] : [];
      waitingLobbies[meetingCode] = [];
      broadcastToHosts(io, meetingCode, "waiting-room-list", []);

      for (const p of queue) {
        const pSocket = io.sockets.sockets.get(p.socketId);
        if (pSocket) {
          pSocket.emit("lobby-approved");
          await admitParticipant(io, pSocket, meetingCode, p.username);
        }
      }
    });

    // ------------------------------------------------------------------
    // Host permission controls
    // ------------------------------------------------------------------
    socket.on("mute-everyone", async (meetingCode) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      broadcastToRoom(io, meetingCode, socket.id, "host-mute-all");
    });

    socket.on("toggle-chat", async (meetingCode, isChatDisabled) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      try {
        await Meeting.findOneAndUpdate({ meetingCode }, { isChatDisabled });
        broadcastToAll(io, meetingCode, "chat-permission-updated", isChatDisabled);
      } catch (err) { console.error("[Socket] toggle-chat error:", err); }
    });

    socket.on("toggle-screenshare", async (meetingCode, isScreenShareDisabled) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      try {
        await Meeting.findOneAndUpdate({ meetingCode }, { isScreenShareDisabled });
        broadcastToAll(io, meetingCode, "screenshare-permission-updated", isScreenShareDisabled);
      } catch (err) { console.error("[Socket] toggle-screenshare error:", err); }
    });

    socket.on("toggle-lock", async (meetingCode, isLocked) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      try {
        await Meeting.findOneAndUpdate({ meetingCode }, { isLocked });
        broadcastToAll(io, meetingCode, "meeting-lock-updated", isLocked);
      } catch (err) { console.error("[Socket] toggle-lock error:", err); }
    });

    socket.on("remove-participant", (meetingCode, targetSocketId) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit("host-removed-you");
        targetSocket.disconnect();
      }
    });

    socket.on("end-meeting-all", async (meetingCode) => {
      if (!isSocketHost(socket.id, meetingCode)) return;
      try {
        await Meeting.findOneAndUpdate({ meetingCode }, { meetingStatus: "ENDED" });
      } catch (err) { /* non-critical */ }

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((id) => {
          const s = io.sockets.sockets.get(id);
          if (s) {
            s.emit("meeting-ended-by-host");
            s.disconnect();
          }
        });
      }
    });

    // ------------------------------------------------------------------
    // WebRTC signaling
    // ------------------------------------------------------------------
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // ------------------------------------------------------------------
    // Chat
    // ------------------------------------------------------------------
    socket.on("chat-message", (data, sender) => {
      const meetingCode = findRoomForSocket(socket.id);
      if (!meetingCode) return;

      if (!messages[meetingCode]) messages[meetingCode] = [];
      messages[meetingCode].push({ sender, data, "socket-id-sender": socket.id });

      connections[meetingCode].forEach((id) => {
        io.to(id).emit("chat-message", data, sender, socket.id);
      });
    });

    // ------------------------------------------------------------------
    // Raise hand
    // ------------------------------------------------------------------
    socket.on("raise-hand", (meetingCode, raised) => {
      if (!connections[meetingCode]) return;
      const meta = socketMeta[socket.id];
      connections[meetingCode].forEach((id) => {
        if (id !== socket.id) {
          io.to(id).emit("user-raised-hand", socket.id, raised, meta?.username || "Unknown");
        }
      });
    });

    // ------------------------------------------------------------------
    // Emoji reactions
    // ------------------------------------------------------------------
    socket.on("send-emoji", (meetingCode, emoji) => {
      if (!connections[meetingCode]) return;
      const meta = socketMeta[socket.id];
      connections[meetingCode].forEach((id) => {
        if (id !== socket.id) {
          io.to(id).emit("emoji-received", emoji, meta?.username || "Unknown");
        }
      });
    });

    // ------------------------------------------------------------------
    // Live transcription
    // ------------------------------------------------------------------
    socket.on("transcription-chunk", async (path, speaker, text) => {
      const pathParts = path.split("/");
      const meetingCode = pathParts[pathParts.length - 1];

      await saveTranscriptSegment(meetingCode, speaker, text);

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((id) => {
          io.to(id).emit("transcription-chunk", speaker, text);
        });
      }
    });

    // ------------------------------------------------------------------
    // Disconnect
    // ------------------------------------------------------------------
    socket.on("disconnect", () => {
      const meta = socketMeta[socket.id] || {};
      delete socketMeta[socket.id];

      // Clean up host socket registry
      Object.keys(hostSockets).forEach((code) => {
        hostSockets[code] = hostSockets[code].filter((id) => id !== socket.id);
      });

      // Clean up waiting lobbies
      Object.keys(waitingLobbies).forEach((code) => {
        if (waitingLobbies[code]) {
          waitingLobbies[code] = waitingLobbies[code].filter((p) => p.socketId !== socket.id);
          broadcastToHosts(io, code, "waiting-room-list", waitingLobbies[code]);
        }
      });

      // Remove from active rooms
      for (const [meetingCode, participants] of Object.entries(connections)) {
        const idx = participants.indexOf(socket.id);
        if (idx === -1) continue;

        // Notify everyone this user left
        participants.forEach((id) => io.to(id).emit("user-left", socket.id));
        participants.splice(idx, 1);

        // If room is now empty → run AI post-processing
        if (participants.length === 0) {
          const code = meetingCode;
          delete connections[code];

          getFullTranscriptText(code)
            .then(async (fullText) => {
              if (fullText && fullText.trim() !== "") {
                console.log(`[AI] Post-meeting processing for: ${code}`);
                await generateSummary(code, fullText);
                await extractTasks(code, fullText);
                await generateAnalytics(code);
                console.log(`[AI] Done for: ${code}`);
              }
            })
            .catch((err) => console.error("[AI] Post-meeting error:", err));
        }
        break;
      }

      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a socket belongs to the host of a meeting.
 * Uses userId stored in socketMeta to compare against meeting.hostId in DB.
 */
const isSocketHost = (socketId, meetingCode) => {
  const meta = socketMeta[socketId];
  if (!meta || !meta.userId) return false;
  // hostSockets is built during join-call when userId === meeting.hostId
  return hostSockets[meetingCode]?.includes(socketId) || false;
};

const findRoomForSocket = (socketId) => {
  for (const [code, participants] of Object.entries(connections)) {
    if (participants.includes(socketId)) return code;
  }
  return null;
};

const broadcastToHosts = (io, meetingCode, event, ...args) => {
  const hosts = hostSockets[meetingCode] || [];
  hosts.forEach((id) => io.to(id).emit(event, ...args));
};

const broadcastToRoom = (io, meetingCode, excludeSocketId, event, ...args) => {
  const participants = connections[meetingCode] || [];
  participants.forEach((id) => {
    if (id !== excludeSocketId) io.to(id).emit(event, ...args);
  });
};

const broadcastToAll = (io, meetingCode, event, ...args) => {
  const participants = connections[meetingCode] || [];
  participants.forEach((id) => io.to(id).emit(event, ...args));
};

/**
 * Admit a participant into the WebRTC room.
 * Syncs past chat, transcripts, and permission state.
 */
const admitParticipant = async (io, socket, meetingCode, username) => {
  if (!connections[meetingCode]) connections[meetingCode] = [];
  connections[meetingCode].push(socket.id);
  timeOnline[socket.id] = new Date();

  // Notify everyone (including the new joiner) about updated participant list
  connections[meetingCode].forEach((id) => {
    io.to(id).emit("user-joined", socket.id, connections[meetingCode]);
  });

  // Replay chat history
  if (messages[meetingCode]) {
    messages[meetingCode].forEach((msg) => {
      io.to(socket.id).emit("chat-message", msg.data, msg.sender, msg["socket-id-sender"]);
    });
  }

  // Replay transcript history
  try {
    const segments = await Transcript.find({ meetingCode }).sort({ timestamp: 1 });
    segments.forEach((seg) => {
      io.to(socket.id).emit("transcription-chunk", seg.speaker, seg.text);
    });
  } catch (err) {
    console.error("[Socket] Transcript replay error:", err);
  }

  // Sync current meeting permissions
  try {
    const meeting = await Meeting.findOne({ meetingCode });
    if (meeting) {
      if (meeting.isChatDisabled)        socket.emit("chat-permission-updated", true);
      if (meeting.isScreenShareDisabled) socket.emit("screenshare-permission-updated", true);
      if (meeting.isMutedAll)            socket.emit("host-mute-all");
    }
  } catch (err) {
    console.error("[Socket] Permission sync error:", err);
  }
};
