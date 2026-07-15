import { Server } from "socket.io";
import { Transcript } from "../models/transcript.model.js";
import { saveTranscriptSegment, getFullTranscriptText } from "../services/transcriptionService.js";
import { generateSummary } from "../services/summaryService.js";
import { extractTasks } from "../services/taskExtractionService.js";
import { generateAnalytics } from "../services/analyticsService.js";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("SOMETHING CONNECTED");

    socket.on("join-call", async (path) => {
      if (connections[path] === undefined) {
        connections[path] = [];
      }
      connections[path].push(socket.id);

      timeOnline[socket.id] = new Date();

      // Broadcast join event
      for (let a = 0; a < connections[path].length; a++) {
        io.to(connections[path][a]).emit(
          "user-joined",
          socket.id,
          connections[path]
        );
      }

      // Sync existing chat messages
      if (messages[path] !== undefined) {
        for (let a = 0; a < messages[path].length; ++a) {
          io.to(socket.id).emit(
            "chat-message",
            messages[path][a]["data"],
            messages[path][a]["sender"],
            messages[path][a]["socket-id-sender"]
          );
        }
      }

      // Sync existing transcripts
      try {
        const segments = await Transcript.find({ meetingCode: path }).sort({ timestamp: 1 });
        segments.forEach((seg) => {
          io.to(socket.id).emit("transcription-chunk", seg.speaker, seg.text);
        });
      } catch (err) {
        console.error("Error syncing previous transcripts:", err);
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
        console.log("message", matchingRoom, ":", sender, data);

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // Real-time transcription sync & save
    socket.on("transcription-chunk", async (path, speaker, text) => {
      await saveTranscriptSegment(path, speaker, text);
      if (connections[path] !== undefined) {
        connections[path].forEach((elem) => {
          io.to(elem).emit("transcription-chunk", speaker, text);
        });
      }
    });

    socket.on("disconnect", () => {
      var diffTime = Math.abs(timeOnline[socket.id] - new Date());
      var key;

      for (const [k, v] of JSON.parse(
        JSON.stringify(Object.entries(connections))
      )) {
        for (let a = 0; a < v.length; ++a) {
          if (v[a] === socket.id) {
            key = k;

            for (let a = 0; a < connections[key].length; ++a) {
              io.to(connections[key][a]).emit("user-left", socket.id);
            }

            var index = connections[key].indexOf(socket.id);
            connections[key].splice(index, 1);

            if (connections[key].length === 0) {
              const finishedRoom = key;
              // Generate AI meeting summary, extract tasks & deadlines, compile analytics
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
