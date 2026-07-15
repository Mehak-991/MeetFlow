import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  Badge,
  IconButton,
  TextField,
  Snackbar,
  CircularProgress,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  Box,
  Typography,
  Stack,
  Card,
  CardContent
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import axios from "axios";
import server from "../environment";

import styles from "../styles/videoComponent.module.css";

const server_url = process.env.REACT_APP_SOCKET_URL || "https://meetflow-z69w.onrender.com";

var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  var socketRef = useRef();
  let socketIdRef = useRef();

  let localVideoref = useRef();

  let [videoAvailable, setVideoAvailable] = useState(true);

  let [audioAvailable, setAudioAvailable] = useState(true);

  let [video, setVideo] = useState([]);

  let [audio, setAudio] = useState();

  let [screen, setScreen] = useState();

  let [showModal, setModal] = useState(true);

  let [screenAvailable, setScreenAvailable] = useState();

  let [messages, setMessages] = useState([]);

  let [message, setMessage] = useState("");

  let [newMessages, setNewMessages] = useState(0);

  let [askForUsername, setAskForUsername] = useState(true);

  let [username, setUsername] = useState("");

  const videoRef = useRef([]);

  let [videos, setVideos] = useState([]);

  const [copySnackbar, setCopySnackbar] = useState(false);

  const [transcripts, setTranscripts] = useState([]);
  const [activeTab, setActiveTab] = useState("chat"); // "chat", "transcript", "people"
  const recognitionRef = useRef(null);

  // Pre-join lifecycle & validation states
  const [meetingLoading, setMeetingLoading] = useState(true);
  const [meetingError, setMeetingError] = useState("");
  const [isExpired, setIsExpired] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  
  // Lobby / Waiting Room states
  const [inLobby, setInLobby] = useState(false);
  const [waitingList, setWaitingList] = useState([]);
  const [isHost, setIsHost] = useState(false);

  // Synced Host Permissions
  const [isChatDisabled, setIsChatDisabled] = useState(false);
  const [isScreenShareDisabled, setIsScreenShareDisabled] = useState(false);
  const [isMeetingLocked, setIsMeetingLocked] = useState(false);

  const meetingCode = window.location.pathname.substring(1);

  // Fetch meeting settings and validate expiration
  useEffect(() => {
    const verifyMeeting = async () => {
      try {
        const res = await axios.get(`${server}/api/v1/users/check-meeting/${meetingCode}`);
        const data = res.data;
        if (data.status === "EXPIRED") {
          setIsExpired(true);
          return;
        }
        if (data.isLocked && data.hostId !== username) {
          setMeetingError("This meeting room has been locked by the host.");
          return;
        }
        setIsHost(data.hostId === username);
        setIsChatDisabled(data.isChatDisabled);
        setIsScreenShareDisabled(data.isScreenShareDisabled);
        setIsMeetingLocked(data.isLocked);

        if (data.passwordRequired) {
          setPasswordRequired(true);
        } else {
          getMedia();
        }
      } catch (err) {
        console.error("Meeting verification failed:", err);
        setMeetingError("Meeting room does not exist.");
      } finally {
        setMeetingLoading(false);
      }
    };

    if (!askForUsername && username) {
      verifyMeeting();
    } else {
      setMeetingLoading(false);
    }
  }, [askForUsername, username, meetingCode]);

  const handleValidatePassword = async () => {
    try {
      const res = await axios.post(`${server}/api/v1/users/validate-meeting-password`, {
        meetingCode,
        password: passwordInput
      });
      if (res.data.valid) {
        setPasswordValid(true);
        setPasswordRequired(false);
        // Proceed to join
        getMedia();
      } else {
        alert("Incorrect meeting password.");
      }
    } catch (err) {
      alert("Invalid password.");
    }
  };

  // Initialize Speech Recognition when microphone is active
  useEffect(() => {
    if (askForUsername === false && audio && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const text = event.results[lastResultIndex][0].transcript.trim();
        if (text && socketRef.current) {
          const meetingCode = window.location.pathname.substring(1);
          socketRef.current.emit("transcription-chunk", meetingCode, username, text);
        }
      };

      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e);
      };

      recognition.onend = () => {
        // Restart speech recognition automatically if audio is still enabled
        if (audio && askForUsername === false) {
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to restart speech recognition:", e);
          }
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [askForUsername, audio, username]);

  const downloadTranscript = (format = "txt") => {
    const textContent = transcripts.map(t => `[${t.speaker}]: ${t.text}`).join("\n");
    if (format === "txt") {
      const element = document.createElement("a");
      const file = new Blob([textContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `meeting_transcript_${window.location.pathname.substring(1)}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === "pdf") {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Meeting Transcript - ${window.location.pathname.substring(1)}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
              h1 { color: #018CCB; border-bottom: 2px solid #018CCB; padding-bottom: 10px; }
              .chunk { margin-bottom: 15px; }
              .speaker { font-weight: bold; color: #018CCB; }
              .text { margin-top: 5px; color: #333; }
            </style>
          </head>
          <body>
            <h1>Meeting Transcript</h1>
            <p><strong>Meeting Code:</strong> ${window.location.pathname.substring(1)}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <hr />
            ${transcripts.map(t => `
              <div class="chunk">
                <span class="speaker">${t.speaker}</span>:
                <div class="text">${t.text}</div>
              </div>
            `).join("")}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // --- (all your existing functions remain unchanged) ---
  useEffect(() => {
    getPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let getDislayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDislayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoPermission) {
        setVideoAvailable(true);
      } else {
        setVideoAvailable(false);
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (audioPermission) {
        setAudioAvailable(true);
      } else {
        setAudioAvailable(false);
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, audio]);

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          for (let id in connections) {
            connections[id].addStream(window.localStream);

            connections[id].createOffer().then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        })
    );
  };

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((stream) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  let getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoref.current.srcObject = window.localStream;

          getUserMedia();
        })
    );
  };

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href, username);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      // Google Meet Lobbies & Permissions Sync
      socketRef.current.on("waiting-room-joined", () => {
        setInLobby(true);
      });

      socketRef.current.on("waiting-room-list", (list) => {
        setWaitingList(list);
      });

      socketRef.current.on("lobby-approved", () => {
        setInLobby(false);
      });

      socketRef.current.on("lobby-rejected", () => {
        alert("The host declined your join request.");
        window.location.href = "/";
      });

      socketRef.current.on("chat-permission-updated", (disabled) => {
        setIsChatDisabled(disabled);
      });

      socketRef.current.on("screenshare-permission-updated", (disabled) => {
        setIsScreenShareDisabled(disabled);
        if (disabled) {
          setScreen(false);
        }
      });

      socketRef.current.on("host-mute-all", () => {
        setAudio(false);
        try {
          window.localStream.getAudioTracks().forEach(track => track.enabled = false);
        } catch (e) {}
        alert("The host has muted everyone.");
      });

      socketRef.current.on("host-removed-you", () => {
        alert("You have been removed from the meeting by the host.");
        window.location.href = "/";
      });

      socketRef.current.on("meeting-ended-by-host", () => {
        alert("This meeting has been ended by the host.");
        window.location.href = "/";
      });

      socketRef.current.on("transcription-chunk", (speaker, text) => {
        setTranscripts((prev) => [
          ...prev,
          { speaker, text, timestamp: new Date() }
        ]);
      });

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );
          // Wait for their ice candidate
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Wait for their video stream
          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId
            );

            if (videoExists) {
              // Update the stream of the existing video
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              // Create a new video
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          // Add the local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription })
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };
  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  let handleVideo = () => {
    setVideo(!video);
  };
  let handleAudio = () => {
    setAudio(!audio);
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDislayMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  let handleScreen = () => {
    if (isScreenShareDisabled && !isHost) {
      alert("Screen sharing has been disabled by the host.");
      return;
    }
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = "/";
  };

  let closeChat = () => {
    setModal(false);
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prevNewMessages) => prevNewMessages + 1);
    }
  };

  let sendMessage = () => {
    if (!message || !socketRef.current) return;
    if (isChatDisabled && !isHost) {
      alert("Chat has been disabled by the host.");
      return;
    }
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  let handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  let connect = () => {
    if (!username.trim()) {
      alert("Please enter a username.");
      return;
    }
    setAskForUsername(false);
  };

  const copyMeetingCode = () => {
    const meetingLink = window.location.href;
    navigator.clipboard.writeText(meetingLink);
    setCopySnackbar(true);
  };

  // Host Action Emit Triggers
  const handleHostMuteAll = () => {
    if (socketRef.current) socketRef.current.emit("mute-everyone", meetingCode);
  };

  const handleHostToggleChat = () => {
    if (socketRef.current) socketRef.current.emit("toggle-chat", meetingCode, !isChatDisabled);
  };

  const handleHostToggleScreenShare = () => {
    if (socketRef.current) socketRef.current.emit("toggle-screenshare", meetingCode, !isScreenShareDisabled);
  };

  const handleHostToggleLock = () => {
    if (socketRef.current) socketRef.current.emit("toggle-lock", meetingCode, !isMeetingLocked);
  };

  const handleHostRemoveParticipant = (id) => {
    if (socketRef.current) socketRef.current.emit("remove-participant", meetingCode, id);
  };

  const handleHostEndMeetingAll = () => {
    if (socketRef.current) socketRef.current.emit("end-meeting-all", meetingCode);
  };

  const handleHostLobbyDecision = (id, approved) => {
    if (socketRef.current) socketRef.current.emit("host-decision", meetingCode, id, approved);
  };

  const handleHostLobbyApproveAll = () => {
    if (socketRef.current) socketRef.current.emit("approve-all", meetingCode);
  };

  // -------------------- RENDER --------------------
  if (meetingLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#fff" }}>
        <CircularProgress size={50} sx={{ color: "#018CCB" }} />
        <Typography variant="body1" sx={{ mt: 3, fontWeight: "bold" }}>Verifying meeting...</Typography>
      </Box>
    );
  }

  if (meetingError) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#fff", p: 3, textAlign: "center" }}>
        <Typography variant="h5" color="error" sx={{ fontWeight: "bold", mb: 2 }}>Access Denied</Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>{meetingError}</Typography>
        <Button variant="contained" onClick={() => window.location.href = "/"} sx={{ backgroundColor: "#018CCB" }}>Go to Home</Button>
      </Box>
    );
  }

  if (isExpired) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#fff", p: 3, textAlign: "center" }}>
        <Typography variant="h4" color="error" sx={{ fontWeight: "bold", mb: 2 }}>This meeting has expired</Typography>
        <Typography variant="body1" sx={{ mb: 4, color: "#ccc" }}>The host set a schedule duration which has concluded.</Typography>
        <Button variant="contained" onClick={() => window.location.href = "/"} sx={{ backgroundColor: "#018CCB" }}>Go to Home</Button>
      </Box>
    );
  }

  if (passwordRequired && !passwordValid) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#fff", p: 3 }}>
        <Card sx={{ maxWidth: 400, width: "100%", p: 2, backgroundColor: "#1a1a1a", border: "1px solid #333", color: "#fff" }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2, color: "#018CCB" }}>Password Required</Typography>
            <Typography variant="body2" sx={{ mb: 3, color: "#ccc" }}>This meeting is password-protected. Enter credentials to join.</Typography>
            <TextField
              type="password"
              placeholder="Enter meeting password"
              fullWidth
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              InputProps={{ style: { color: "#fff", backgroundColor: "#2b2b2b" } }}
              sx={{ mb: 3 }}
            />
            <Button variant="contained" fullWidth onClick={handleValidatePassword} sx={{ backgroundColor: "#018CCB" }}>Join Meeting</Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (inLobby) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#fff", p: 3, textAlign: "center" }}>
        <CircularProgress size={40} sx={{ color: "#018CCB", mb: 3 }} />
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1.5 }}>Waiting for the host to let you in...</Typography>
        <Typography variant="body2" sx={{ color: "#aaa" }}>You will join the video call automatically as soon as your request is approved.</Typography>
      </Box>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {askForUsername === true ? (
        <div className={styles.lobbyContainer}>
          <h2 className={styles.lobbyTitle}>Enter into Lobby</h2>

          <div className={styles.lobbyControls}>
            <TextField
              id="outlined-basic"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              size="small"
            />
            <Button variant="contained" onClick={connect}>
              Connect
            </Button>
          </div>

          <div className={styles.lobbyPreview}>
            <video ref={localVideoref} autoPlay muted className={styles.lobbyVideo}></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetContainer}>
          
          {/* CHAT & TRANSCRIPT & PEOPLE PANEL */}
          {showModal && (
            <aside className={styles.chatPanel}>
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <button
                  onClick={() => setActiveTab("chat")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: activeTab === "chat" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: activeTab === "chat" ? "#018CCB" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                    borderBottom: activeTab === "chat" ? "2px solid #018CCB" : "none"
                  }}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("transcript")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: activeTab === "transcript" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: activeTab === "transcript" ? "#018CCB" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                    borderBottom: activeTab === "transcript" ? "2px solid #018CCB" : "none"
                  }}
                >
                  Transcript
                </button>
                <button
                  onClick={() => setActiveTab("people")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: activeTab === "people" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: activeTab === "people" ? "#018CCB" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                    borderBottom: activeTab === "people" ? "2px solid #018CCB" : "none"
                  }}
                >
                  People
                </button>
                <button 
                  className={styles.closeChatBtn} 
                  onClick={closeChat}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#fff",
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "0 10px"
                  }}
                >×</button>
              </div>

              {activeTab === "chat" ? (
                <>
                  <div className={styles.chatBody}>
                    {messages.length ? (
                      messages.map((item, index) => (
                        <div key={index} className={styles.chatMessage}>
                          <div className={styles.chatSender}>{item.sender}</div>
                          <div className={styles.chatText}>{item.data}</div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyChat}>No messages yet</div>
                    )}
                  </div>

                  <div className={styles.chatInput}>
                    <TextField
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={isChatDisabled && !isHost ? "Chat disabled by host" : "Type a message..."}
                      disabled={isChatDisabled && !isHost}
                      size="small"
                      fullWidth
                    />
                    <Button variant="contained" onClick={sendMessage} disabled={isChatDisabled && !isHost}>Send</Button>
                  </div>
                </>
              ) : activeTab === "transcript" ? (
                <>
                  <div className={styles.chatBody} style={{ padding: "10px" }}>
                    {transcripts.length ? (
                      transcripts.map((item, index) => (
                        <div key={index} style={{ marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px" }}>
                          <div style={{ fontWeight: "bold", color: "#018CCB", fontSize: "13px" }}>{item.speaker}</div>
                          <div style={{ color: "#e0e0e0", fontSize: "14px", marginTop: "2px" }}>{item.text}</div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptyChat}>No speech transcribed yet. Speak into your mic!</div>
                    )}
                  </div>

                  <div style={{ padding: "10px", display: "flex", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <Button variant="outlined" fullWidth size="small" onClick={() => downloadTranscript("txt")} style={{ borderColor: "#018CCB", color: "#018CCB" }}>
                      Export TXT
                    </Button>
                    <Button variant="contained" fullWidth size="small" onClick={() => downloadTranscript("pdf")} style={{ backgroundColor: "#018CCB" }}>
                      Export PDF
                    </Button>
                  </div>
                </>
              ) : (
                /* PEOPLE & HOST CONTROLS PANEL */
                <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                  {/* Host settings toggle list */}
                  {isHost && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#018CCB", mb: 1 }}>Host Controls</Typography>
                      <Stack spacing={1}>
                        <FormControlLabel
                          control={<Switch checked={isMeetingLocked} onChange={handleHostToggleLock} size="small" />}
                          label={<Typography variant="body2" color="#fff">Lock Meeting Room</Typography>}
                        />
                        <FormControlLabel
                          control={<Switch checked={isChatDisabled} onChange={handleHostToggleChat} size="small" />}
                          label={<Typography variant="body2" color="#fff">Disable Chat for Guests</Typography>}
                        />
                        <FormControlLabel
                          control={<Switch checked={isScreenShareDisabled} onChange={handleHostToggleScreenShare} size="small" />}
                          label={<Typography variant="body2" color="#fff">Disable Screen Sharing</Typography>}
                        />
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button variant="outlined" color="warning" size="small" fullWidth onClick={handleHostMuteAll} style={{ fontSize: "11px" }}>
                          Mute Everyone
                        </Button>
                        <Button variant="contained" color="error" size="small" fullWidth onClick={handleHostEndMeetingAll} style={{ fontSize: "11px" }}>
                          End for All
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {/* Lobby Queue (Admit list) */}
                  {isHost && waitingList.length > 0 && (
                    <Box sx={{ mb: 3, p: 1.5, border: "1px dashed #fff59d", backgroundColor: "rgba(255,245,157,0.05)", borderRadius: "8px" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#fff59d" }}>Lobby Queue ({waitingList.length})</Typography>
                        <Button size="small" variant="text" onClick={handleHostLobbyApproveAll} style={{ fontSize: "11px", color: "#fff59d" }}>Admit All</Button>
                      </Box>
                      <List dense>
                        {waitingList.map((p) => (
                          <ListItem
                            key={p.socketId}
                            secondaryAction={
                              <Stack direction="row" spacing={1}>
                                <Button variant="contained" color="success" size="small" onClick={() => handleHostLobbyDecision(p.socketId, true)} style={{ padding: "2px 8px", fontSize: "10px" }}>Admit</Button>
                                <Button variant="outlined" color="error" size="small" onClick={() => handleHostLobbyDecision(p.socketId, false)} style={{ padding: "2px 8px", fontSize: "10px" }}>Deny</Button>
                              </Stack>
                            }
                            disablePadding
                            sx={{ py: 0.5 }}
                          >
                            <ListItemText primary={<Typography variant="body2" sx={{ color: "#fff" }}>{p.username}</Typography>} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,0.1)" }} />

                  {/* Participant roster list */}
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#018CCB", mt: 1, mb: 1 }}>Roster List</Typography>
                  <List dense>
                    {/* Local User */}
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ color: "#fff", fontWeight: "bold" }}>{username} (You)</Typography>}
                        secondary={<Typography variant="caption" color="primary">Host</Typography>}
                      />
                    </ListItem>

                    {/* Remote users */}
                    {videos.map((v) => (
                      <ListItem
                        key={v.socketId}
                        secondaryAction={
                          isHost && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleHostRemoveParticipant(v.socketId)}
                              style={{ padding: "2px 8px", fontSize: "10px" }}
                            >
                              Remove
                            </Button>
                          )
                        }
                        sx={{ px: 0 }}
                      >
                        <ListItemText
                          primary={<Typography variant="body2" sx={{ color: "#fff" }}>Participant (ID: {v.socketId.substring(0, 5)})</Typography>}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Copy Meeting Code Section */}
              <div style={{
                padding: "15px",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                backgroundColor: "rgba(0,0,0,0.2)"
              }}>
                <div style={{ marginBottom: "8px", color: "#b0b0b0", fontSize: "12px" }}>Meeting Code</div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <TextField
                    value={window.location.pathname.substring(1)}
                    size="small"
                    fullWidth
                    InputProps={{
                      readOnly: true,
                      style: { color: "#fff", fontSize: "14px" }
                    }}
                  />
                  <IconButton
                    onClick={copyMeetingCode}
                    size="small"
                    style={{ backgroundColor: "#018CCB", color: "#fff" }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            </aside>
          )}

          {/* MAIN AREA */}
          <main className={styles.mainArea}>
            <div className={styles.conferenceWrap}>

              {/* Large Main Video */}
              <div className={styles.primaryVideo}>
                {videos.length > 0 ? (
                  <video
                    ref={(ref) => {
                      if (ref && videos[0] && videos[0].stream) {
                        ref.srcObject = videos[0].stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    className={styles.largeVideo}
                  ></video>
                ) : (
                  <video
                    ref={localVideoref}
                    autoPlay
                    muted
                    className={styles.largeVideo}
                  ></video>
                )}
              </div>

              {/* Conference Grid (EXCLUDES LOCAL VIDEO) */}
              <div className={styles.conferenceGrid}>
                {videos
                  .filter((v) => v.socketId !== socketIdRef.current)
                  .map((video) => (
                    <div key={video.socketId} className={styles.gridItem}>
                      <video
                        data-socket={video.socketId}
                        ref={(ref) => {
                          if (ref && video.stream) {
                            ref.srcObject = video.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className={styles.gridVideo}
                      ></video>
                    </div>
                  ))}
              </div>

            </div>

            {/* BOTTOM CONTROL BAR (centered) */}
            <div className={styles.controlBar}>
              <IconButton onClick={copyMeetingCode} className={styles.controlButton} size="large" title="Copy Meeting Link">
                <ContentCopyIcon />
              </IconButton>

              <IconButton onClick={handleVideo} className={styles.controlButton} size="large">
                {video ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton
                onClick={handleEndCall}
                sx={{ background: "#ff4d4d", color: "white" }}
                size="large"
              >
                <CallEndIcon />
              </IconButton>

              <IconButton onClick={handleAudio} className={styles.controlButton} size="large">
                {audio ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              {screenAvailable && (
                <IconButton onClick={handleScreen} className={styles.controlButton} size="large">
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              )}

              <IconButton
                onClick={() => {
                  setModal(!showModal);
                  if (!showModal) {
                    setNewMessages(0);
                  }
                }}
                className={styles.controlButton}
                size="large"
              >
                <Badge badgeContent={newMessages} color="error">
                  <ChatIcon />
                </Badge>
              </IconButton>
            </div>
          </main>
        </div>
      )}

      <Snackbar
        open={copySnackbar}
        autoHideDuration={3000}
        onClose={() => setCopySnackbar(false)}
        message="Meeting link copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
}
