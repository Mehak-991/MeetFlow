import { Server } from "socket.io";
import { Transcript } from "../models/transcript.model.js";
import { Meeting } from "../models/meeting.model.js";
import { saveTranscriptSegment, getFullTranscriptText } from "../services/transcriptionService.js";
import { generateSummary } from "../services/summaryService.js";
import { extractTasks } from "../services/taskExtractionService.js";
import { generateAnalytics } from "../services/analyticsService.js";

let connections = {};
let messages = {};
let timeOnline = {};

// Google Meet lobbies & permissions dictionaries
let waitingLobbies = {}; // { [meetingCode]: [{ socketId, username }] }
let hostSockets = {};    // { [meetingCode]: [socketId] }
let socketUsernames = {}; // { [socketId]: username }

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("SOMETHING CONNECTED:", socket.id);

    socket.on("join-call", async (path, username) => {
      socketUsernames[socket.id] = username;
      
      // Extract meetingCode from the URL path
      const urlParts = path.split("/");
      const meetingCode = urlParts[urlParts.length - 1];

      try {
        const meeting = await Meeting.findOne({ meetingCode });
        const isHost = meeting ? (meeting.hostId === username) : false;

        if (isHost) {
          if (!hostSockets[meetingCode]) {
            hostSockets[meetingCode] = [];
          }
          hostSockets[meetingCode].push(socket.id);
        }

        // Check if waiting room is enabled and user is NOT host
        if (meeting?.waitingRoomEnabled && !isHost) {
          if (!waitingLobbies[meetingCode]) {
            waitingLobbies[meetingCode] = [];
          }
          
          // Add to waiting queue
          waitingLobbies[meetingCode].push({ socketId: socket.id, username });
          
          // Notify the participant they are in the waiting lobby
          socket.emit("waiting-room-joined");

          // Notify all host sockets in the room about the new waiting list
          if (hostSockets[meetingCode]) {
            hostSockets[meetingCode].forEach((hostId) => {
              io.to(hostId).emit("waiting-room-list", waitingLobbies[meetingCode]);
            });
          }
          return;
        }

        // If no waiting room, proceed with joining room directly
        await admitParticipant(io, socket, meetingCode, username);
      } catch (err) {
        console.error("Error in join-call handler:", err);
      }
    });

    // Host decision on waiting participant (approve/reject)
    socket.on("host-decision", async (meetingCode, participantSocketId, approved) => {
      // Security check: Verify sender is actually a host of the meeting
      const meeting = await Meeting.findOne({ meetingCode });
      const hostUsername = socketUsernames[socket.id];
      if (meeting?.hostId !== hostUsername) {
        return socket.emit("error-message", "Only hosts can manage waiting room.");
      }

      if (!waitingLobbies[meetingCode]) return;

      const participantIndex = waitingLobbies[meetingCode].findIndex(
        (p) => p.socketId === participantSocketId
      );

      if (participantIndex !== -1) {
        const participant = waitingLobbies[meetingCode][participantIndex];
        
        // Remove from waiting queue
        waitingLobbies[meetingCode].splice(participantIndex, 1);

        // Update host list
        if (hostSockets[meetingCode]) {
          hostSockets[meetingCode].forEach((hostId) => {
            io.to(hostId).emit("waiting-room-list", waitingLobbies[meetingCode]);
          });
        }

        const participantSocket = io.sockets.sockets.get(participantSocketId);
        if (approved) {
          if (participantSocket) {
            participantSocket.emit("lobby-approved");
            await admitParticipant(io, participantSocket, meetingCode, participant.username);
          }
        } else {
          if (participantSocket) {
            participantSocket.emit("lobby-rejected");
            participantSocket.disconnect();
          }
        }
      }
    });

    // Approve all participants in lobby
    socket.on("approve-all", async (meetingCode) => {
      const meeting = await Meeting.findOne({ meetingCode });
      const hostUsername = socketUsernames[socket.id];
      if (meeting?.hostId !== hostUsername) return;

      if (waitingLobbies[meetingCode]) {
        const queue = [...waitingLobbies[meetingCode]];
        waitingLobbies[meetingCode] = [];

        // Notify hosts
        if (hostSockets[meetingCode]) {
          hostSockets[meetingCode].forEach((hostId) => {
            io.to(hostId).emit("waiting-room-list", []);
          });
        }

        for (const p of queue) {
          const pSocket = io.sockets.sockets.get(p.socketId);
          if (pSocket) {
            pSocket.emit("lobby-approved");
            await admitParticipant(io, pSocket, meetingCode, p.username);
          }
        }
      }
    });

    // HOST PERMISSION EVENTS
    socket.on("mute-everyone", async (meetingCode) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      // Broadcast mute all event to all participants
      if (connections[meetingCode]) {
        connections[meetingCode].forEach((elem) => {
          if (elem !== socket.id) {
            io.to(elem).emit("host-mute-all");
          }
        });
      }
    });

    socket.on("toggle-chat", async (meetingCode, isChatDisabled) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      meeting.isChatDisabled = isChatDisabled;
      await meeting.save();

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((elem) => {
          io.to(elem).emit("chat-permission-updated", isChatDisabled);
        });
      }
    });

    socket.on("toggle-screenshare", async (meetingCode, isScreenShareDisabled) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      meeting.isScreenShareDisabled = isScreenShareDisabled;
      await meeting.save();

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((elem) => {
          io.to(elem).emit("screenshare-permission-updated", isScreenShareDisabled);
        });
      }
    });

    socket.on("toggle-lock", async (meetingCode, isLocked) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      meeting.isLocked = isLocked;
      await meeting.save();

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((elem) => {
          io.to(elem).emit("meeting-lock-updated", isLocked);
        });
      }
    });

    socket.on("remove-participant", async (meetingCode, targetSocketId) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit("host-removed-you");
        targetSocket.disconnect();
      }
    });

    socket.on("end-meeting-all", async (meetingCode) => {
      const meeting = await Meeting.findOne({ meetingCode });
      if (meeting?.hostId !== socketUsernames[socket.id]) return;

      if (connections[meetingCode]) {
        connections[meetingCode].forEach((elem) => {
          const s = io.sockets.sockets.get(elem);
          if (s) {
            s.emit("meeting-ended-by-host");
            s.disconnect();
          }
        });
      }
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false]
      );

      if (found === true) {
        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }

        messages[matchingRoom].push({
          sender: sender,
          data: data,
          "socket-id-sender": socket.id,
        });

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    socket.on("transcription-chunk", async (path, speaker, text) => {
      const urlParts = path.split("/");
      const meetingCode = urlParts[urlParts.length - 1];

      await saveTranscriptSegment(meetingCode, speaker, text);
      if (connections[meetingCode] !== undefined) {
        connections[meetingCode].forEach((elem) => {
          io.to(elem).emit("transcription-chunk", speaker, text);
        });
      }
    });

    socket.on("disconnect", () => {
      const username = socketUsernames[socket.id];
      delete socketUsernames[socket.id];

      // Cleanup host sockets
      Object.keys(hostSockets).forEach((code) => {
        hostSockets[code] = hostSockets[code].filter((id) => id !== socket.id);
      });

      // Cleanup waiting lobby queues
      Object.keys(waitingLobbies).forEach((code) => {
        if (waitingLobbies[code]) {
          waitingLobbies[code] = waitingLobbies[code].filter(
            (p) => p.socketId !== socket.id
          );
          // Broadcast updated lobby list to hosts
          if (hostSockets[code]) {
            hostSockets[code].forEach((hostId) => {
              io.to(hostId).emit("waiting-room-list", waitingLobbies[code]);
            });
          }
        }
      });

      for (const [k, v] of JSON.parse(
        JSON.stringify(Object.entries(connections))
      )) {
        for (let a = 0; a < v.length; ++a) {
          if (v[a] === socket.id) {
            const key = k;

            for (let a = 0; a < connections[key].length; ++a) {
              io.to(connections[key][a]).emit("user-left", socket.id);
            }

            var index = connections[key].indexOf(socket.id);
            connections[key].splice(index, 1);

            if (connections[key].length === 0) {
              const finishedRoom = key;
              getFullTranscriptText(finishedRoom)
                .then(async (fullText) => {
                  if (fullText && fullText.trim() !== "") {
                    console.log(`Processing AI analysis for completed meeting: ${finishedRoom}`);
                    await generateSummary(finishedRoom, fullText);
                    await extractTasks(finishedRoom, fullText);
                    await generateAnalytics(finishedRoom);
                    console.log(`AI processing completed for meeting: ${finishedRoom}`);
                  }
                })
                .catch((err) => {
                  console.error("AI Post-meeting processing failed:", err);
                });

              delete connections[finishedRoom];
            }
          }
        }
      }
    });
  });

  return io;
};

// Helper: admitting a participant into standard call connections
const admitParticipant = async (io, socket, meetingCode, username) => {
  if (connections[meetingCode] === undefined) {
    connections[meetingCode] = [];
  }
  connections[meetingCode].push(socket.id);

  timeOnline[socket.id] = new Date();

  // Notify existing participants in the room
  for (let a = 0; a < connections[meetingCode].length; a++) {
    io.to(connections[meetingCode][a]).emit(
      "user-joined",
      socket.id,
      connections[meetingCode]
    );
  }

  // Sync past chats
  if (messages[meetingCode] !== undefined) {
    for (let a = 0; a < messages[meetingCode].length; ++a) {
      io.to(socket.id).emit(
        "chat-message",
        messages[meetingCode][a]["data"],
        messages[meetingCode][a]["sender"],
        messages[meetingCode][a]["socket-id-sender"]
      );
    }
  }

  // Sync past transcripts
  try {
    const segments = await Transcript.find({ meetingCode }).sort({ timestamp: 1 });
    segments.forEach((seg) => {
      io.to(socket.id).emit("transcription-chunk", seg.speaker, seg.text);
    });
  } catch (err) {
    console.error("Error syncing previous transcripts:", err);
  }

  // Notify new user of current permissions (locked chat / screenshare / mute status)
  try {
    const meeting = await Meeting.findOne({ meetingCode });
    if (meeting) {
      if (meeting.isChatDisabled) socket.emit("chat-permission-updated", true);
      if (meeting.isScreenShareDisabled) socket.emit("screenshare-permission-updated", true);
      if (meeting.isMutedAll) socket.emit("host-mute-all");
    }
  } catch (err) {
    console.error("Error syncing permissions on join:", err);
  }
};
