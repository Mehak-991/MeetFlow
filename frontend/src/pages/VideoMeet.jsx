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
  Checkbox,
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Menu
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
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import BlurOffIcon from "@mui/icons-material/BlurOff";
import HearingIcon from "@mui/icons-material/Hearing";
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import LaptopIcon from "@mui/icons-material/Laptop";
import InfoIcon from "@mui/icons-material/Info";
import ShareIcon from "@mui/icons-material/Share";
import SettingsIcon from "@mui/icons-material/Settings";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import server from "../environment";

import styles from "../styles/videoComponent.module.css";
import PeopleSidebar from "../components/PeopleSidebar";
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

  let [showModal, setModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Derived: any side panel open?
  const isPanelOpen = showModal || showPeopleModal;

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

  // Pre-join Device & Audio Filtering states
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [selectedAudio, setSelectedAudio] = useState("");
  const [backgroundBlur, setBackgroundBlur] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [companionMode, setCompanionMode] = useState(false);
  const [presentOnly, setPresentOnly] = useState(false);

  // Web Audio refs for real-time mic test & noise suppression filter
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioSourceRef = useRef(null);

  // AI Q&A and Meeting Intelligence States
  const [aiChatHistory, setAiChatHistory] = useState([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Google Meet UI Interactivity States
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState({});
  const [showCaptions, setShowCaptions] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerTimerRef = useRef(null);

  // Settings Dialog Panel States
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("audio");
  const [mirrorMode, setMirrorMode] = useState(false);
  const [hdMode, setHdMode] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [layoutMode, setLayoutMode] = useState("comfortable");
  const [micMenuAnchor, setMicMenuAnchor] = useState(null);
  const [camMenuAnchor, setCamMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [meetingDuration, setMeetingDuration] = useState(0);

  // Add People Dialog Spacing & State
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isGroupEmail, setIsGroupEmail] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const suggestionsList = [
    { name: "Mohit Kumar Singh", email: "mohit.singh@techolution.com", initials: "MS" },
    { name: "Aarav Sharma", email: "aarav.sharma@gmail.com", initials: "AS" },
    { name: "Mehak Verma", email: "mehak.verma@meetflow.com", initials: "MV" }
  ];

  useEffect(() => {
    let interval = null;
    if (!askForUsername) {
      interval = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [askForUsername]);

  // Sync isFullscreen state with browser fullscreen changes (e.g., Escape key)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSendInvitations = async () => {
    const targets = inviteEmail.trim() ? [inviteEmail, ...selectedSuggestions] : selectedSuggestions;
    if (targets.length === 0) return;

    try {
      const response = await axios.post(`${server}/api/v1/users/send-invitation`, {
        emails: targets,
        meetingCode: window.location.pathname.substring(1),
        senderName: username || "A user",
        isGroupEmail: isGroupEmail
      });

      if (response.data.previewUrl) {
        alert(`Invitation sent successfully! Since you are running in local test mode, you can view the sent email inbox here:\n\n${response.data.previewUrl}`);
      } else {
        alert(`Invitation sent successfully to ${targets.join(", ")}!`);
      }
      
      // Clear state and close
      setAddPeopleOpen(false);
      setInviteEmail("");
      setSelectedSuggestions([]);
    } catch (err) {
      console.error(err);
      alert(`Error sending invitation: ${err.response?.data?.message || err.message}`);
    }
  };

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
        // Only block if meeting is locked AND has a known host who isn't the current user.
        // If hostId is null (auto-created for invited candidates), don't block anyone.
        if (data.isLocked && data.hostId && data.hostId !== username) {
          setMeetingError("This meeting room has been locked by the host.");
          return;
        }
        setIsHost(!!data.hostId && data.hostId === username);
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

  // Enumerate active devices
  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter(d => d.kind === "videoinput");
      const audioDevs = devices.filter(d => d.kind === "audioinput");
      setVideoDevices(videoDevs);
      setAudioDevices(audioDevs);
      if (videoDevs.length && !selectedVideo) setSelectedVideo(videoDevs[0].deviceId);
      if (audioDevs.length && !selectedAudio) setSelectedAudio(audioDevs[0].deviceId);
    } catch (e) {
      console.error("Error enumerating devices:", e);
    }
  };

  useEffect(() => {
    getDevices();
    navigator.mediaDevices.ondevicechange = getDevices;
  }, []);

  const handleDeviceChange = async (videoDeviceId, audioDeviceId) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : video,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : audio
      });
      window.localStream = stream;
      if (localVideoref.current) {
        localVideoref.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Failed to switch devices:", e);
    }
  };

  // Monitor Mic Input level for mic testing
  useEffect(() => {
    if (askForUsername && audio && window.localStream) {
      try {
        const audioTracks = window.localStream.getAudioTracks();
        if (audioTracks.length === 0) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let sourceNode = audioCtx.createMediaStreamSource(window.localStream);
        
        if (noiseSuppression) {
          const filter = audioCtx.createBiquadFilter();
          filter.type = "highpass";
          filter.frequency.value = 150; // Filter low-frequency static noise
          sourceNode.connect(filter);
          filter.connect(analyser);
        } else {
          sourceNode.connect(analyser);
        }

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        audioSourceRef.current = sourceNode;

        const draw = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArrayRef.current[i];
          }
          const average = sum / bufferLength;
          setMicLevel(average);
          animationFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (err) {
        console.error("Audio Context setup failed:", err);
      }
    } else {
      cleanupAudioContext();
    }

    return () => cleanupAudioContext();
  }, [askForUsername, audio, noiseSuppression]);

  const cleanupAudioContext = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  // Inject keyframes for floating emojis and hand bounces dynamically on mount
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes floatUp {
        0% { transform: translateY(0) scale(0.6); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 0.9; }
        100% { transform: translateY(-350px) scale(1.3); opacity: 0; }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
        const commandText = text.toLowerCase();

        // Voice Command Parsing
        if (commandText.includes("mute me")) {
          setAudio(false);
          alert("[Voice Command] Muting microphone");
        } else if (commandText.includes("unmute me")) {
          setAudio(true);
          alert("[Voice Command] Unmuting microphone");
        } else if (commandText.includes("turn on camera") || commandText.includes("open camera")) {
          setVideo(true);
          alert("[Voice Command] Turning on camera");
        } else if (commandText.includes("turn off camera") || commandText.includes("close camera")) {
          setVideo(false);
          alert("[Voice Command] Turning off camera");
        } else if (commandText.includes("share screen")) {
          handleScreen();
          alert("[Voice Command] Toggling screen share");
        } else if (commandText.includes("raise hand")) {
          handleRaiseHand();
          alert("[Voice Command] Toggling raised hand");
        } else if (commandText.includes("open chat")) {
          setModal(true);
          setActiveTab("chat");
          alert("[Voice Command] Opening Chat");
        } else if (commandText.includes("leave meeting")) {
          handleEndCall();
        }

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
        setCaptionText(`${speaker}: "${text}"`);
        setTimeout(() => {
          setCaptionText(prev => prev.startsWith(speaker) ? "" : prev);
        }, 4000);
      });

      socketRef.current.on("user-raised-hand", (id, raised, senderName) => {
        setRaisedHands(prev => ({ ...prev, [id]: raised }));
      });

      socketRef.current.on("emoji-received", (emoji, senderName) => {
        triggerFloatingEmoji(emoji);
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

  const handleRaiseHand = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (socketRef.current) {
      socketRef.current.emit("raise-hand", meetingCode, nextState);
    }
  };
  const getInitials = (name = "") => {
    if (!name.trim()) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const triggerFloatingEmoji = (emoji, senderName = "Guest") => {
    const id = Math.random();
    setFloatingEmojis(prev => [...prev, { id, emoji, senderName, left: Math.random() * 60 + 20 }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2500);
  };

  const sendEmoji = (emoji) => {
    if (socketRef.current) {
      socketRef.current.emit("send-emoji", meetingCode, emoji);
    }
    triggerFloatingEmoji(emoji, username || "You");
    resetPickerTimer();
  };

  const resetPickerTimer = () => {
    clearPickerTimer();
    pickerTimerRef.current = setTimeout(() => {
      setShowEmojiPicker(false);
    }, 5000);
  };

  const clearPickerTimer = () => {
    if (pickerTimerRef.current) {
      clearTimeout(pickerTimerRef.current);
      pickerTimerRef.current = null;
    }
  };

  const toggleEmojiPicker = () => {
    const nextState = !showEmojiPicker;
    setShowEmojiPicker(nextState);
    if (nextState) {
      resetPickerTimer();
    } else {
      clearPickerTimer();
    }
  };

  // Keyboard navigation and listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmojiPicker(false);
        setSettingsOpen(false);
        setModal(false);
        setShowPeopleModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPickerTimer();
    };
  }, []);

  const askAIQuestion = async (question) => {
    if (!question.trim()) return;
    setAiLoading(true);
    setAiChatHistory(prev => [...prev, { role: "user", text: question }]);
    setAiQuestion("");
    try {
      const res = await axios.post(`${server}/api/v1/users/meeting-assistant`, {
        meetingCode,
        question
      });
      setAiChatHistory(prev => [...prev, { role: "ai", text: res.data.answer }]);
    } catch (err) {
      console.error("AI Assistant request failed:", err);
      setAiChatHistory(prev => [...prev, { role: "ai", text: "Error connecting to AI service." }]);
    } finally {
      setAiLoading(false);
    }
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
        <div className={styles.preJoinContainer}>
          {/* Left Panel: Preview Video Box */}
          <div className={styles.preJoinLeft}>
            <div className={styles.preJoinPreview}>
              <video 
                ref={localVideoref} 
                autoPlay 
                muted 
                className={styles.preJoinVideo}
                style={{ filter: backgroundBlur ? "blur(12px) contrast(1.1)" : "none" }}
              ></video>
              <div className={styles.preJoinLeftControls}>
                <IconButton onClick={() => setVideo(!video)} style={{ color: video ? "#fff" : "#ff4d4d" }}>
                  {video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <IconButton onClick={() => setAudio(!audio)} style={{ color: audio ? "#fff" : "#ff4d4d" }}>
                  {audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton onClick={() => setBackgroundBlur(!backgroundBlur)} style={{ color: backgroundBlur ? "#018CCB" : "#fff" }} title="Toggle Background Blur">
                  {backgroundBlur ? <BlurOnIcon /> : <BlurOffIcon />}
                </IconButton>
                <IconButton onClick={() => setNoiseSuppression(!noiseSuppression)} style={{ color: noiseSuppression ? "#018CCB" : "#fff" }} title="Toggle AI Noise Suppression">
                  <HearingIcon />
                </IconButton>
              </div>
            </div>
            
            {/* Audio Indicator */}
            {audio && (
              <div className={styles.micIndicatorWrap} style={{ width: "100%", maxWidth: "640px", marginTop: "12px" }}>
                <VolumeUpIcon fontSize="small" style={{ color: "#aaa" }} />
                <div className={styles.micIndicatorTrack}>
                  <div className={styles.micIndicatorFill} style={{ width: `${Math.min(micLevel * 3.5, 100)}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Join Settings */}
          <div className={styles.preJoinRight}>
            <h1 className={styles.preJoinTitle}>Ready to join?</h1>
            <p className={styles.preJoinSubtitle}>Manage your devices and enter a nickname to get started.</p>

            <TextField
              label="Username / Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              fullWidth
              InputProps={{ style: { color: "#fff", backgroundColor: "rgba(255,255,255,0.03)" } }}
            />

            {/* Device Selectors Card */}
            <div className={styles.deviceSelectorCard}>
              <Typography variant="caption" style={{ color: "#aaa", fontWeight: "bold" }}>INPUT DEVICES</Typography>
              
              {/* Camera Selector */}
              <FormControl fullWidth size="small">
                <Select
                  value={selectedVideo}
                  onChange={(e) => {
                    setSelectedVideo(e.target.value);
                    handleDeviceChange(e.target.value, selectedAudio);
                  }}
                  displayEmpty
                  style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.2)" }}
                >
                  <MenuItem value="" disabled>Select Camera</MenuItem>
                  {videoDevices.map(d => (
                    <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.substring(0,5)}`}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Microphone Selector */}
              <FormControl fullWidth size="small">
                <Select
                  value={selectedAudio}
                  onChange={(e) => {
                    setSelectedAudio(e.target.value);
                    handleDeviceChange(selectedVideo, e.target.value);
                  }}
                  displayEmpty
                  style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.2)" }}
                >
                  <MenuItem value="" disabled>Select Microphone</MenuItem>
                  {audioDevices.map(d => (
                    <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substring(0,5)}`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>

            {/* Join Action Buttons */}
            <div className={styles.joinButtonRow}>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={() => {
                  setCompanionMode(false);
                  setPresentOnly(false);
                  connect();
                }}
                style={{ backgroundColor: "#018CCB", fontWeight: "bold" }}
              >
                Join Now
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={() => {
                  setCompanionMode(false);
                  setPresentOnly(true);
                  setVideo(false);
                  connect();
                }}
                style={{ borderColor: "#018CCB", color: "#018CCB", fontWeight: "bold" }}
                startIcon={<PresentToAllIcon />}
              >
                Present
              </Button>
            </div>

            <Button 
              variant="text" 
              fullWidth 
              onClick={() => {
                setCompanionMode(true);
                setVideo(false);
                setAudio(false);
                connect();
              }}
              style={{ color: "#aaa", fontSize: "12px", textTransform: "none" }}
              startIcon={<LaptopIcon />}
            >
              Use Companion Mode (No audio/video)
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.meetContainer} style={{ display: "flex", flexDirection: "row", overflow: "hidden" }}>
          {/* MAIN AREA — animated width */}
          <motion.main
            className={isFullscreen ? styles.fullscreenMain : styles.mainArea}
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "relative", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}
          >
            {/* FLOATING TOP STATUS BAR (inside motion.main to overlay the video container) */}
            <div style={{
              position: "absolute",
              top: 24,
              left: 24,
              right: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 95,
              pointerEvents: "none"
            }}>
              <div style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                pointerEvents: "auto",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "500"
              }}>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ fontWeight: "bold" }}>{meetingCode}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }} title="Meeting details">ⓘ</span>
              </div>

              <div style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                pointerEvents: "auto"
              }}>
                <div 
                  onClick={() => {
                    setShowPeopleModal(!showPeopleModal);
                    setModal(false);
                  }}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "#e91e63",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "13px",
                    color: "#fff",
                    position: "relative",
                    cursor: "pointer"
                  }}
                  title="People"
                >
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
            </div>

            <div className={styles.conferenceWrap}>
              {/* Grid Wrapper */}
              {screen ? (
                /* Screen Share Active Viewport */
                <div style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  gap: "16px",
                  flexDirection: "row"
                }}>
                  {/* Main Screen Share Area */}
                  <div style={{
                    flex: 3,
                    position: "relative",
                    borderRadius: "20px",
                    overflow: "hidden",
                    backgroundColor: "#000",
                    border: "2px solid #018CCB"
                  }}>
                    <video
                      ref={localVideoref}
                      autoPlay
                      muted
                      playsInline
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    ></video>
                    <div style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px"
                    }}>
                      🖥️ You are presenting
                    </div>
                  </div>

                  {/* Sidebar Thumbnails */}
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    overflowY: "auto",
                    minWidth: "220px"
                  }}>
                    {/* Remote streams thumbnails */}
                    {videos.map((v) => (
                      <div key={v.socketId} style={{
                        position: "relative",
                        width: "100%",
                        height: "140px",
                        borderRadius: "20px",
                        overflow: "hidden",
                        backgroundColor: "#1e1e1f",
                        border: "1px solid rgba(255,255,255,0.06)"
                      }}>
                        <video
                          ref={(ref) => {
                            if (ref && v.stream) {
                              ref.srcObject = v.stream;
                            }
                          }}
                          autoPlay
                          playsInline
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        ></video>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Regular Grid Layout */
                <div style={{
                  display: "grid",
                  gap: "12px",
                  width: "100%",
                  height: "100%",
                  gridTemplateColumns: videos.length === 0 ? "1fr" :
                                       videos.length === 1 ? "1fr 1fr" :
                                       videos.length === 2 ? "repeat(auto-fit, minmax(320px, 1fr))" :
                                       "repeat(auto-fit, minmax(280px, 1fr))",
                  gridTemplateRows: "1fr",
                  alignItems: "stretch",
                  justifyItems: "stretch"
                }}>
                  {/* Local user tile (Always rendered immediately) */}
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: "20px",
                    overflow: "hidden",
                    backgroundColor: "#1e1e1f",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
                  }}>
                    {video ? (
                      <video
                        ref={localVideoref}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: mirrorMode ? "scaleX(-1)" : "none" }}
                      ></video>
                    ) : (
                      <div style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #111, #1e1e1f)"
                      }}>
                        <div style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #018CCB, #016b9b)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "#fff",
                          boxShadow: "0 8px 16px rgba(0,0,0,0.3)"
                        }}>
                          {getInitials(username)}
                        </div>
                      </div>
                    )}
                               {/* Tile Bottom Overlay Info */}
                    <div style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      backgroundColor: "rgba(0,0,0,0.5)",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      backdropFilter: "blur(10px)",
                      width: "fit-content"
                    }}>
                      <span style={{ fontSize: "12px", fontWeight: "bold", color: "#fff" }}>
                        {username || "You"} (Host)
                      </span>
                    </div>
                  </div>

                  {/* Remote users tiles */}
                  {videos.map((v) => (
                    <div key={v.socketId} style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      borderRadius: "20px",
                      overflow: "hidden",
                      backgroundColor: "#1e1e1f",
                      border: "1px solid rgba(255,255,255,0.06)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
                    }}>
                      <video
                        ref={(ref) => {
                          if (ref && v.stream) {
                            ref.srcObject = v.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      ></video>

                      {/* Tile Bottom Overlay Info */}
                      <div style={{
                        position: "absolute",
                        bottom: "12px",
                        left: "12px",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        backdropFilter: "blur(10px)",
                        width: "fit-content"
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#fff" }}>
                          Guest ({v.socketId.substring(0, 5)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Emojis Animation Track */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 120, overflow: "hidden" }}>
              {floatingEmojis.map(e => (
                <div
                  key={e.id}
                  style={{
                    position: "absolute",
                    bottom: "100px",
                    left: `${e.left}%`,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(0,0,0,0.65)",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: "500",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    animation: "floatUp 2.5s forwards ease-in-out"
                  }}
                >
                  <span style={{ fontSize: "22px" }}>{e.emoji}</span>
                  <span style={{ fontSize: "11px", fontWeight: "bold", opacity: 0.9 }}>{e.senderName}</span>
                </div>
              ))}
            </div>

            {/* Live Captions Display Box */}
            {showCaptions && captionText && (
              <div style={{
                position: "absolute",
                bottom: "110px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(0,0,0,0.75)",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "500",
                zIndex: 110,
                maxWidth: "80%",
                textAlign: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
              }}>
                {captionText}
              </div>
            )}

            {/* FLOATING PILL REACTION PICKER */}
            {showEmojiPicker && (
              <div 
                onMouseEnter={resetPickerTimer}
                onMouseLeave={resetPickerTimer}
                style={{
                  position: "absolute",
                  bottom: "85px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 16px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(30, 30, 31, 0.9)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
                  zIndex: 105,
                  overflowX: "auto",
                  maxWidth: "90vw"
                }}
              >
                {["❤️", "👍", "🎉", "👏", "😂", "😮", "😢", "🤔", "👎", "🔥", "🚀", "🙌", "👏👏", "😊"].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendEmoji(emoji)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "22px",
                      cursor: "pointer",
                      padding: "4px",
                      transition: "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                      borderRadius: "50%"
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = "scale(1.25)";
                      e.target.style.backgroundColor = "rgba(255,255,255,0.08)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = "scale(1.0)";
                      e.target.style.backgroundColor = "transparent";
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* BOTTOM CONTROL BAR (centered) */}
            <div className={styles.controlBar} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "10px 24px",
              borderRadius: "9999px",
              backgroundColor: "rgba(30, 30, 31, 0.75)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              maxWidth: "fit-content",
              margin: "0 auto",
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100
            }}>
              {/* Activity Indicator */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "12px",
                backgroundColor: "rgba(76, 175, 80, 0.15)",
                color: "#4caf50",
                fontSize: "11px",
                fontWeight: "bold",
                marginRight: "6px"
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block", animation: "bounce 1.5s infinite" }}></span>
                Live
              </div>

              {/* Microphone Button with dropdown trigger */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <IconButton
                  onClick={handleAudio}
                  style={{
                    backgroundColor: audio ? "rgba(255,255,255,0.08)" : "#ff4d4d",
                    color: "#fff",
                    width: "44px",
                    height: "44px"
                  }}
                  title={audio ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => setMicMenuAnchor(e.currentTarget)}
                  style={{ color: "#aaa", marginLeft: "-8px" }}
                >
                  <span style={{ fontSize: "10px" }}>▼</span>
                </IconButton>
              </div>

              {/* Camera Button with dropdown trigger */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <IconButton
                  onClick={handleVideo}
                  style={{
                    backgroundColor: video ? "rgba(255,255,255,0.08)" : "#ff4d4d",
                    color: "#fff",
                    width: "44px",
                    height: "44px"
                  }}
                  title={video ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => setCamMenuAnchor(e.currentTarget)}
                  style={{ color: "#aaa", marginLeft: "-8px" }}
                >
                  <span style={{ fontSize: "10px" }}>▼</span>
                </IconButton>
              </div>

              {/* Screen Share */}
              {screenAvailable && (
                <IconButton
                  onClick={handleScreen}
                  style={{
                    backgroundColor: screen ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                    color: screen ? "#018CCB" : "#fff",
                    width: "44px",
                    height: "44px"
                  }}
                  title={screen ? "Stop Sharing" : "Share Screen"}
                >
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              )}

              {/* Hand Raise */}
              <IconButton
                onClick={handleRaiseHand}
                style={{
                  backgroundColor: isHandRaised ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                  color: isHandRaised ? "#018CCB" : "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Raise Hand"
              >
                <span style={{ fontSize: "18px" }}>✋</span>
              </IconButton>

              {/* Live Captions Toggle */}
              <IconButton
                onClick={() => setShowCaptions(!showCaptions)}
                style={{
                  backgroundColor: showCaptions ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                  color: showCaptions ? "#018CCB" : "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Toggle Live Captions"
              >
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>CC</span>
              </IconButton>

              {/* Emoji Reactions Trigger Button */}
              <IconButton
                onClick={toggleEmojiPicker}
                style={{
                  backgroundColor: showEmojiPicker ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                  color: showEmojiPicker ? "#018CCB" : "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Send Reaction"
              >
                <SentimentSatisfiedAltIcon />
              </IconButton>

              {/* Settings Toggle Button */}
              <IconButton
                onClick={() => setSettingsOpen(true)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Settings"
              >
                <SettingsIcon />
              </IconButton>

              {/* Fullscreen Toggle Button */}
              <IconButton
                onClick={() => {
                  if (!isFullscreen) {
                    document.documentElement.requestFullscreen?.();
                  } else {
                    document.exitFullscreen?.();
                  }
                  setIsFullscreen(!isFullscreen);
                }}
                style={{
                  backgroundColor: isFullscreen ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                  color: isFullscreen ? "#018CCB" : "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                <span style={{ fontSize: "16px" }}>{isFullscreen ? "⛶" : "⛶"}</span>
              </IconButton>

              {/* More Options Vert Button */}
              <IconButton
                onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                style={{
                  backgroundColor: moreMenuAnchor ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="More Options"
              >
                <MoreVertIcon />
              </IconButton>

              {/* MORE OPTIONS MENU POPUP */}
              <Menu
                anchorEl={moreMenuAnchor}
                open={Boolean(moreMenuAnchor)}
                onClose={() => setMoreMenuAnchor(null)}
                PaperProps={{
                  style: {
                    backgroundColor: "rgba(30, 30, 31, 0.95)",
                    backdropFilter: "blur(20px)",
                    color: "#fff",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    width: "320px",
                    maxHeight: "400px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                  }
                }}
              >
                {/* MEETING SECTION */}
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#018CCB" }}>MEETING</MenuItem>
                <MenuItem onClick={() => { alert("Casting initiated..."); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>📺</span> Cast this Meeting
                </MenuItem>
                <MenuItem onClick={() => { alert("Recording started successfully"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🎥</span> Start Recording
                </MenuItem>
                <MenuItem onClick={() => { alert("Recording paused"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>⏸</span> Pause Recording
                </MenuItem>
                <MenuItem onClick={() => { alert("Recording stopped. Summary generated."); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>⏹</span> Stop Recording
                </MenuItem>
                <MenuItem onClick={() => { alert("Change view layouts under Appearance Settings tab."); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🖥</span> Adjust Layout
                </MenuItem>
                <MenuItem onClick={() => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); } else { document.exitFullscreen(); } setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🖼</span> Fullscreen
                </MenuItem>
                <MenuItem onClick={() => { alert("Picture-in-Picture mode opened"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🗔</span> Picture-in-Picture Mode
                </MenuItem>
                <MenuItem onClick={() => { setSettingsOpen(true); setSettingsTab("appearance"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🎨</span> Background & Effects
                </MenuItem>
                <MenuItem onClick={() => { copyMeetingCode(); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🔗</span> Copy Meeting Link
                </MenuItem>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                {/* AI FEATURES SECTION */}
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#018CCB" }}>AI FEATURES</MenuItem>
                <MenuItem onClick={() => { setModal(true); setActiveTab("assistant"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🤖</span> AI Assistant Sidepanel
                </MenuItem>
                <MenuItem onClick={() => { askAIQuestion("Summarize today's meeting."); setModal(true); setActiveTab("assistant"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>📝</span> Generate Meeting Summary
                </MenuItem>
                <MenuItem onClick={() => { askAIQuestion("What were today's decisions?"); setModal(true); setActiveTab("assistant"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>📌</span> Extract Key Decisions
                </MenuItem>
                <MenuItem onClick={() => { downloadTranscript("txt"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>⬇</span> Download Transcript
                </MenuItem>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                {/* TOOLS SECTION */}
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#018CCB" }}>TOOLS</MenuItem>
                <MenuItem onClick={() => { setSettingsOpen(true); setSettingsTab("audio"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🔊</span> Audio Settings
                </MenuItem>
                <MenuItem onClick={() => { setSettingsOpen(true); setSettingsTab("video"); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>📷</span> Camera Settings
                </MenuItem>
                <MenuItem onClick={() => { setSettingsOpen(true); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>⚙</span> All Settings Tab
                </MenuItem>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                {/* HELP SECTION */}
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#018CCB" }}>HELP</MenuItem>
                <MenuItem onClick={() => { alert("Problem report submitted."); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>🐞</span> Report a Problem
                </MenuItem>
                <MenuItem onClick={() => { alert("Help Center references opened."); setMoreMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  <span style={{ marginRight: "12px" }}>❓</span> Help Center
                </MenuItem>
              </Menu>

              {/* Leave Meeting Button (Red) */}
              <IconButton
                onClick={handleEndCall}
                style={{
                  backgroundColor: "#ff4d4d",
                  color: "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Leave Meeting"
              >
                <CallEndIcon />
              </IconButton>

              {/* MIC SUBMENU POPUP */}
              <Menu
                anchorEl={micMenuAnchor}
                open={Boolean(micMenuAnchor)}
                onClose={() => setMicMenuAnchor(null)}
                PaperProps={{ style: { backgroundColor: "#1e1e1f", color: "#fff" } }}
              >
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#888" }}>SELECT MICROPHONE</MenuItem>
                {audioDevices.map(d => (
                  <MenuItem key={d.deviceId} onClick={() => { setSelectedAudio(d.deviceId); handleDeviceChange(selectedVideo, d.deviceId); setMicMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                    {selectedAudio === d.deviceId ? "✓ " : ""}{d.label || `Microphone ${d.deviceId.substring(0,5)}`}
                  </MenuItem>
                ))}
                <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
                <MenuItem onClick={() => { setNoiseSuppression(!noiseSuppression); setMicMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  {noiseSuppression ? "Disable" : "Enable"} AI Noise Suppression
                </MenuItem>
                <MenuItem onClick={() => { setEchoCancellation(!echoCancellation); setMicMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  {echoCancellation ? "Disable" : "Enable"} Echo Cancellation
                </MenuItem>
              </Menu>

              {/* CAMERA SUBMENU POPUP */}
              <Menu
                anchorEl={camMenuAnchor}
                open={Boolean(camMenuAnchor)}
                onClose={() => setCamMenuAnchor(null)}
                PaperProps={{ style: { backgroundColor: "#1e1e1f", color: "#fff" } }}
              >
                <MenuItem disabled style={{ fontSize: "11px", fontWeight: "bold", color: "#888" }}>SELECT CAMERA</MenuItem>
                {videoDevices.map(d => (
                  <MenuItem key={d.deviceId} onClick={() => { setSelectedVideo(d.deviceId); handleDeviceChange(d.deviceId, selectedAudio); setCamMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                    {selectedVideo === d.deviceId ? "✓ " : ""}{d.label || `Camera ${d.deviceId.substring(0,5)}`}
                  </MenuItem>
                ))}
                <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
                <MenuItem onClick={() => { setMirrorMode(!mirrorMode); setCamMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  {mirrorMode ? "Disable" : "Enable"} Mirror Webcam
                </MenuItem>
                <MenuItem onClick={() => { setHdMode(!hdMode); setCamMenuAnchor(null); }} style={{ fontSize: "13px" }}>
                  {hdMode ? "Disable" : "Enable"} HD Video (720p)
                </MenuItem>
              </Menu>
            </div>

            {/* BOTTOM-RIGHT QUICK ACTIONS (exactly like reference image) */}
            <div style={{
              position: "absolute",
              bottom: "20px",
              right: "24px",
              display: "flex",
              gap: "12px",
              zIndex: 100
            }}>
              {/* Chat Toggle Button */}
              <IconButton
                onClick={() => {
                  setModal(!showModal);
                  if (!showModal) {
                    setNewMessages(0);
                  }
                }}
                style={{
                  backgroundColor: showModal ? "rgba(1, 140, 203, 0.25)" : "rgba(255,255,255,0.08)",
                  color: "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="In-call Chat"
              >
                <Badge badgeContent={newMessages} color="error">
                  <ChatIcon />
                </Badge>
              </IconButton>

              {/* Host Control Toggle Button (Lock icon) */}
              <IconButton
                onClick={() => {
                  alert("Host Controls: Lock meeting settings are active.");
                }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  width: "44px",
                  height: "44px"
                }}
                title="Host Controls"
              >
                <span style={{ fontSize: "18px" }}>🔒</span>
              </IconButton>
            </div>
          </motion.main>

          {/* CHAT PANEL — animated, RIGHT side */}
          <AnimatePresence>
            {showModal && activeTab === "chat" && (
            <motion.aside
              key="chat-panel"
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                width: "360px",
                flexShrink: 0,
                backgroundColor: "#1e1e1f",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                boxSizing: "border-box",
                overflow: "hidden",
                position: "relative",
                zIndex: 90,
                boxShadow: "-4px 0 24px rgba(0,0,0,0.4)"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#fff" }}>In-call messages</span>
                <button
                  onClick={closeChat}
                  style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>

              {/* Host chat toggle */}
              {isHost && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "8px", marginBottom: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "12px", color: "#ccc" }}>Let participants send messages</span>
                  <Switch checked={!isChatDisabled} onChange={(e) => handleHostToggleChat(!e.target.checked)} size="small" />
                </div>
              )}

              {/* Alert banner */}
              <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "12px", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "14px" }}>💬</span>
                <div style={{ fontSize: "11px", color: "#aaa", lineHeight: "1.4" }}>
                  <strong style={{ color: "#fff" }}>Continuous chat is turned off</strong><br />
                  Messages are not saved after the call ends.
                </div>
              </div>

              {/* Messages */}
              <div className={styles.chatBody} style={{ flex: 1, overflowY: "auto", marginBottom: "16px" }}>
                {messages.length ? (
                  messages.map((item, index) => (
                    <div key={index} style={{ marginBottom: "12px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "12px", color: "#60a5fa", marginRight: "8px" }}>{item.sender}</span>
                      <span style={{ fontSize: "11px", color: "#888" }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div style={{ fontSize: "13px", color: "#fff", marginTop: "4px", backgroundColor: "rgba(255,255,255,0.04)", padding: "8px 12px", borderRadius: "8px", maxWidth: "90%", width: "fit-content" }}>
                        {item.data}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", color: "#888", fontSize: "12px", marginTop: "40px" }}>No messages in-call yet.</div>
                )}
              </div>

              {/* Input */}
              <div style={{ display: "flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "24px", padding: "4px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <TextField
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isChatDisabled && !isHost ? "Chat is disabled" : "Send a message"}
                  disabled={isChatDisabled && !isHost}
                  variant="standard"
                  InputProps={{ disableUnderline: true, style: { color: "#fff", fontSize: "13px" } }}
                  fullWidth
                />
                <IconButton onClick={sendMessage} disabled={isChatDisabled && !isHost} size="small" style={{ color: "#fff" }}>➤</IconButton>
              </div>
            </motion.aside>
            )}
          </AnimatePresence>

          {/* AI ASSISTANT PANEL — animated, RIGHT side */}
          <AnimatePresence>
            {showModal && activeTab === "assistant" && (
            <motion.aside
              key="ai-panel"
              initial={{ x: 360, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 360, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                width: "360px",
                flexShrink: 0,
                backgroundColor: "#1e1e1f",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                boxSizing: "border-box",
                overflow: "hidden",
                position: "relative",
                zIndex: 90,
                boxShadow: "-4px 0 24px rgba(0,0,0,0.4)"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🤖</span> AI Meeting Assistant
                </span>
                <button
                  onClick={() => setModal(false)}
                  style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>

              {/* Suggestions / Chips */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                <Button
                  size="small"
                  onClick={() => askAIQuestion("Summarize today's meeting.")}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    textTransform: "none",
                    borderRadius: "16px",
                    fontSize: "11px",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  📝 Summarize Meeting
                </Button>
                <Button
                  size="small"
                  onClick={() => askAIQuestion("What were today's decisions?")}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: "#fff",
                    textTransform: "none",
                    borderRadius: "16px",
                    fontSize: "11px",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  📌 Extract Key Decisions
                </Button>
              </div>

              {/* Chat History */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
                {aiChatHistory.length ? (
                  aiChatHistory.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                        backgroundColor: item.role === "user" ? "rgba(1, 140, 203, 0.15)" : "rgba(255,255,255,0.04)",
                        border: item.role === "user" ? "1px solid rgba(1, 140, 203, 0.3)" : "1px solid rgba(255,255,255,0.06)",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        fontSize: "13px",
                        color: "#fff",
                        wordBreak: "break-word"
                      }}
                    >
                      <div style={{ fontSize: "10px", color: item.role === "user" ? "#60a5fa" : "#018CCB", fontWeight: "bold", marginBottom: "4px" }}>
                        {item.role === "user" ? "You" : "MeetFlow AI"}
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.4" }}>{item.text}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", color: "#888", fontSize: "12px", marginTop: "40px", padding: "0 20px", lineHeight: "1.5" }}>
                    Ask me anything about this meeting room, transcripts, summaries, or decisions.
                  </div>
                )}
                
                {aiLoading && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "10px 14px", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px" }}>
                    <CircularProgress size={16} style={{ color: "#018CCB" }} />
                    <span style={{ fontSize: "12px", color: "#aaa" }}>Thinking...</span>
                  </div>
                )}
              </div>

              {/* Input block */}
              <div style={{ display: "flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "24px", padding: "4px 12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <TextField
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyPress={(e) => { if (e.key === "Enter") askAIQuestion(aiQuestion); }}
                  placeholder="Ask a question..."
                  variant="standard"
                  InputProps={{ disableUnderline: true, style: { color: "#fff", fontSize: "13px" } }}
                  fullWidth
                />
                <IconButton onClick={() => askAIQuestion(aiQuestion)} size="small" style={{ color: "#fff" }}>
                  ➤
                </IconButton>
              </div>
            </motion.aside>
            )}
          </AnimatePresence>

          {/* PEOPLE PANEL — animated, RIGHT side */}
          <PeopleSidebar 
            isOpen={showPeopleModal} 
            onClose={() => setShowPeopleModal(false)}
            onAddPeople={() => setAddPeopleOpen(true)}
            username={username}
            videos={videos}
          />
        </div>
      )}

      {/* Add People Dialog */}
      <Dialog
        open={addPeopleOpen}
        onClose={() => {
          setAddPeopleOpen(false);
          setInviteEmail("");
          setSelectedSuggestions([]);
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: "#fff",
            color: "#111",
            borderRadius: "16px",
            padding: "24px",
            boxSizing: "border-box"
          }
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <Typography variant="h6" style={{ fontWeight: "600", fontSize: "20px", color: "#202124" }}>
            Add people
          </Typography>
          <IconButton 
            onClick={() => {
              setAddPeopleOpen(false);
              setInviteEmail("");
              setSelectedSuggestions([]);
            }}
            size="small" 
            style={{ color: "#5f6368" }}
          >
            ×
          </IconButton>
        </div>

        {/* Invite Tab */}
        <div style={{ display: "flex", justifyContent: "center", borderBottom: "1.5px solid #1a73e8", paddingBottom: "12px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1a73e8", fontWeight: "600", fontSize: "14px" }}>
            <span style={{ fontSize: "18px" }}>👤+</span> Invite
          </div>
        </div>

        {/* Input */}
        <TextField
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="Enter name or email"
          variant="outlined"
          fullWidth
          size="small"
          InputProps={{
            style: {
              borderRadius: "8px",
              fontSize: "14px",
              color: "#202124"
            }
          }}
          style={{ marginBottom: "20px" }}
        />

        {/* Suggestions Title */}
        <Typography variant="subtitle2" style={{ fontWeight: "600", color: "#5f6368", marginBottom: "12px", fontSize: "12px" }}>
          Suggestions
        </Typography>

        {/* Suggestions list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          {suggestionsList.map((contact) => {
            const isChecked = selectedSuggestions.includes(contact.email);
            return (
              <div 
                key={contact.email} 
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "#1a73e8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "#fff"
                  }}>
                    {contact.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#202124" }}>{contact.name}</div>
                    <div style={{ fontSize: "12px", color: "#5f6368" }}>{contact.email}</div>
                  </div>
                </div>
                <Checkbox
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSuggestions([...selectedSuggestions, contact.email]);
                    } else {
                      setSelectedSuggestions(selectedSuggestions.filter(email => email !== contact.email));
                    }
                  }}
                  color="primary"
                />
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={isGroupEmail} onChange={(e) => setIsGroupEmail(e.target.checked)} color="primary" />}
            label={<span style={{ fontSize: "13px", color: "#5f6368", fontWeight: 500 }}>Send as group email</span>}
          />
          <Button
            variant="contained"
            disabled={!inviteEmail.trim() && selectedSuggestions.length === 0}
            onClick={handleSendInvitations}
            style={{
              backgroundColor: (!inviteEmail.trim() && selectedSuggestions.length === 0) ? "rgba(0,0,0,0.12)" : "#1a73e8",
              color: (!inviteEmail.trim() && selectedSuggestions.length === 0) ? "rgba(0,0,0,0.26)" : "#fff",
              textTransform: "none",
              borderRadius: "20px",
              padding: "6px 20px",
              fontWeight: "600"
            }}
          >
            Send email
          </Button>
        </div>
      </Dialog>

      {/* SaaS Settings Dialog */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: "#1e1e1f",
            color: "#fff",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)"
          }
        }}
      >
        <DialogTitle style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", fontWeight: "bold", fontSize: "20px" }}>
          Settings
        </DialogTitle>
        <DialogContent style={{ display: "flex", padding: 0, minHeight: "360px" }}>
          {/* Settings Tabs Sidebar */}
          <div style={{
            width: "160px",
            borderRight: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "16px 8px",
            backgroundColor: "rgba(0,0,0,0.1)"
          }}>
            {["general", "audio", "video", "appearance", "notifications", "ai", "privacy"].map(tab => (
              <Button
                key={tab}
                onClick={() => setSettingsTab(tab)}
                style={{
                  justifyContent: "flex-start",
                  textTransform: "capitalize",
                  color: settingsTab === tab ? "#018CCB" : "#fff",
                  backgroundColor: settingsTab === tab ? "rgba(1, 140, 203, 0.1)" : "transparent",
                  fontWeight: settingsTab === tab ? "bold" : "normal",
                  fontSize: "13px",
                  padding: "8px 12px",
                  borderRadius: "8px"
                }}
              >
                {tab}
              </Button>
            ))}
          </div>

          {/* Settings Panel Content */}
          <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", maxHeight: "380px" }}>
            {settingsTab === "general" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>General Settings</Typography>
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Ask to join room (Knock protocol)</Typography>}
                />
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Report diagnostic data to developers</Typography>}
                />
              </>
            )}

            {settingsTab === "audio" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>Audio Configuration</Typography>
                <FormControl fullWidth size="small">
                  <Typography variant="caption" style={{ color: "#aaa", marginBottom: "6px" }}>Microphone</Typography>
                  <Select
                    value={selectedAudio}
                    onChange={(e) => {
                      setSelectedAudio(e.target.value);
                      handleDeviceChange(selectedVideo, e.target.value);
                    }}
                    style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.2)" }}
                  >
                    {audioDevices.map(d => (
                      <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.substring(0,5)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={<Switch checked={noiseSuppression} onChange={(e) => setNoiseSuppression(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">AI Noise Suppression</Typography>}
                />
                
                <FormControlLabel
                  control={<Switch checked={echoCancellation} onChange={(e) => setEchoCancellation(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Echo Cancellation</Typography>}
                />
              </>
            )}

            {settingsTab === "video" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>Video Configuration</Typography>
                <FormControl fullWidth size="small">
                  <Typography variant="caption" style={{ color: "#aaa", marginBottom: "6px" }}>Camera</Typography>
                  <Select
                    value={selectedVideo}
                    onChange={(e) => {
                      setSelectedVideo(e.target.value);
                      handleDeviceChange(e.target.value, selectedAudio);
                    }}
                    style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.2)" }}
                  >
                    {videoDevices.map(d => (
                      <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.substring(0,5)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={<Switch checked={mirrorMode} onChange={(e) => setMirrorMode(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">Mirror Webcam Feed</Typography>}
                />

                <FormControlLabel
                  control={<Switch checked={hdMode} onChange={(e) => setHdMode(e.target.checked)} size="small" />}
                  label={<Typography variant="body2">High Definition (720p/1080p)</Typography>}
                />
              </>
            )}

            {settingsTab === "appearance" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>Appearance Options</Typography>
                <FormControl fullWidth size="small">
                  <Typography variant="caption" style={{ color: "#aaa", marginBottom: "6px" }}>Roster Layout Mode</Typography>
                  <Select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value)}
                    style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.2)" }}
                  >
                    <MenuItem value="compact">Compact View</MenuItem>
                    <MenuItem value="comfortable">Comfortable View</MenuItem>
                  </Select>
                </FormControl>
                
                <Typography variant="caption" style={{ color: "#aaa", marginTop: "10px" }}>Theme</Typography>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button variant="outlined" size="small" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)", fontSize: "11px" }}>Dark Theme</Button>
                  <Button variant="outlined" size="small" style={{ color: "#aaa", borderColor: "rgba(255,255,255,0.1)", fontSize: "11px" }} disabled>Light Theme</Button>
                </div>
              </>
            )}

            {settingsTab === "notifications" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>Notifications</Typography>
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Sound alerts when guests join or leave</Typography>}
                />
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Display desktop notifications for chat messages</Typography>}
                />
              </>
            )}

            {settingsTab === "ai" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>AI Integrations</Typography>
                <Typography variant="body2" style={{ color: "#ccc" }}>
                  - Live transcription captures spoken chunks and runs real-time translation updates.
                </Typography>
                <Typography variant="body2" style={{ color: "#ccc" }}>
                  - Cosine similarity matching vectors are dynamically indexed on database search endpoints.
                </Typography>
                <Typography variant="body2" style={{ color: "#ccc" }}>
                  - Speech analysis generates Kanban boards and email summaries upon call conclusion.
                </Typography>
              </>
            )}

            {settingsTab === "privacy" && (
              <>
                <Typography variant="subtitle2" style={{ fontWeight: "bold", color: "#018CCB" }}>Privacy & Security</Typography>
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Encrypt WebRTC stream endpoints (SRTP)</Typography>}
                />
                <FormControlLabel
                  control={<Switch defaultChecked size="small" />}
                  label={<Typography variant="body2">Blur local stream when entering waiting lobby</Typography>}
                />
              </>
            )}
          </div>
        </DialogContent>
        <DialogActions style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "12px 24px" }}>
          <Button onClick={() => setSettingsOpen(false)} variant="contained" style={{ backgroundColor: "#018CCB" }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

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

const server_url = process.env.REACT_APP_SOCKET_URL || "https://meetflow-z69w.onrender.com";

var connections = {};
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  // ── React Router ──────────────────────────────────────────────────────────
  // Use useParams so meetingCode always matches the route, even with /meeting/:code
  const params = useParams();
  const navigate = useNavigate();
  // Support both route patterns: /:url and /meeting/:meetingCode
  const meetingCode = params.meetingCode || params.url || "";

  // ── Auth identity ─────────────────────────────────────────────────────────
  // userId is stored in localStorage on login — used for host detection
  const storedUserId   = localStorage.getItem("userId")   || "";
  const storedUsername = localStorage.getItem("username") || "";

  // ── Socket & WebRTC refs ──────────────────────────────────────────────────
  var socketRef    = useRef();
  let socketIdRef  = useRef();
  let localVideoref = useRef();
  const videoRef   = useRef([]);

  // ── Media state ───────────────────────────────────────────────────────────
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo]   = useState([]);
  let [audio, setAudio]   = useState();
  let [screen, setScreen] = useState();
  let [screenAvailable, setScreenAvailable] = useState();
  let [videos, setVideos] = useState([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  let [showModal, setModal]           = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const isPanelOpen = showModal || showPeopleModal;

  let [messages, setMessages]     = useState([]);
  let [message, setMessage]       = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername]     = useState(storedUsername);
  const [copySnackbar, setCopySnackbar] = useState(false);
  const [transcripts, setTranscripts]   = useState([]);
  const [activeTab, setActiveTab]       = useState("chat");
  const recognitionRef = useRef(null);

  // ── Meeting validation state ──────────────────────────────────────────────
  const [meetingLoading, setMeetingLoading] = useState(true);
  const [meetingError, setMeetingError]     = useState("");
  const [isExpired, setIsExpired]           = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput]   = useState("");
  const [passwordValid, setPasswordValid]   = useState(false);

  // ── Host / Lobby state ────────────────────────────────────────────────────
  // isHost: true when meeting.hostId === storedUserId (MongoDB _id comparison)
  const [inLobby, setInLobby]         = useState(false);
  const [waitingList, setWaitingList] = useState([]);
  const [isHost, setIsHost]           = useState(false);

  // ── Synced permissions ────────────────────────────────────────────────────
  const [isChatDisabled, setIsChatDisabled]             = useState(false);
  const [isScreenShareDisabled, setIsScreenShareDisabled] = useState(false);
  const [isMeetingLocked, setIsMeetingLocked]           = useState(false);

  // ── Device selectors ──────────────────────────────────────────────────────
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [selectedAudio, setSelectedAudio] = useState("");
  const [backgroundBlur, setBackgroundBlur] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // Audio context refs for mic level meter
  const audioContextRef    = useRef(null);
  const analyserRef        = useRef(null);
  const dataArrayRef       = useRef(null);
  const animationFrameRef  = useRef(null);
  const audioSourceRef     = useRef(null);

  // ── AI / extras ───────────────────────────────────────────────────────────
  const [aiChatHistory, setAiChatHistory] = useState([]);
  const [aiQuestion, setAiQuestion]       = useState("");
  const [aiLoading, setAiLoading]         = useState(false);

  // ── Reactions / hand ─────────────────────────────────────────────────────
  const [isHandRaised, setIsHandRaised]   = useState(false);
  const [raisedHands, setRaisedHands]     = useState({});
  const [showCaptions, setShowCaptions]   = useState(false);
  const [captionText, setCaptionText]     = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerTimerRef = useRef(null);

  // ── Settings ──────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [settingsTab, setSettingsTab]     = useState("audio");
  const [mirrorMode, setMirrorMode]       = useState(false);
  const [hdMode, setHdMode]               = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [layoutMode, setLayoutMode]       = useState("comfortable");
  const [micMenuAnchor, setMicMenuAnchor] = useState(null);
  const [camMenuAnchor, setCamMenuAnchor] = useState(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  const [meetingDuration, setMeetingDuration] = useState(0);

  // ── Add-people dialog ─────────────────────────────────────────────────────
  const [addPeopleOpen, setAddPeopleOpen]     = useState(false);
  const [inviteEmail, setInviteEmail]         = useState("");
  const [isGroupEmail, setIsGroupEmail]       = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const suggestionsList = [
    { name: "Mohit Kumar Singh", email: "mohit.singh@techolution.com", initials: "MS" },
    { name: "Aarav Sharma",      email: "aarav.sharma@gmail.com",      initials: "AS" },
    { name: "Mehak Verma",       email: "mehak.verma@meetflow.com",    initials: "MV" }
  ];

  // ── Meeting duration timer ────────────────────────────────────────────────
  useEffect(() => {
    let interval = null;
    if (!askForUsername) {
      interval = setInterval(() => setMeetingDuration((p) => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [askForUsername]);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Inject keyframe CSS ───────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes floatUp {
        0%   { transform:translateY(0) scale(0.6); opacity:0; }
        10%  { opacity:1; }
        90%  { opacity:0.9; }
        100% { transform:translateY(-350px) scale(1.3); opacity:0; }
      }
      @keyframes bounce {
        0%,100% { transform:translateY(0); }
        50%     { transform:translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ── Meeting validation (runs once when user has entered username) ─────────
  useEffect(() => {
    const verifyMeeting = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${server}/api/v1/users/check-meeting/${meetingCode}`,
          { params: token ? { token } : {} }
        );
        const data = res.data;

        if (data.status === "EXPIRED") { setIsExpired(true); return; }
        if (data.error === "MEETING_LOCKED") {
          setMeetingError("This meeting has been locked by the host.");
          return;
        }

        // Host is determined by MongoDB _id comparison (done server-side)
        setIsHost(!!data.isHost);
        setIsChatDisabled(data.isChatDisabled);
        setIsScreenShareDisabled(data.isScreenShareDisabled);
        setIsMeetingLocked(data.isLocked);

        if (data.passwordRequired) {
          setPasswordRequired(true);
        } else {
          getMedia();
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setMeetingError("Meeting not found. The link may be invalid.");
        } else if (err.response?.status === 403) {
          setMeetingError("This meeting has been locked by the host.");
        } else if (err.response?.status === 410) {
          setIsExpired(true);
        } else {
          setMeetingError("Could not connect to meeting. Please try again.");
        }
      } finally {
        setMeetingLoading(false);
      }
    };

    if (!askForUsername && meetingCode) {
      verifyMeeting();
    } else {
      setMeetingLoading(false);
    }
  }, [askForUsername, meetingCode]);

  // ── Device enumeration ────────────────────────────────────────────────────
  const getDevices = async () => {
    try {
      const devices   = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === "videoinput");
      const audioDevs = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(videoDevs);
      setAudioDevices(audioDevs);
      if (videoDevs.length && !selectedVideo) setSelectedVideo(videoDevs[0].deviceId);
      if (audioDevs.length && !selectedAudio) setSelectedAudio(audioDevs[0].deviceId);
    } catch (e) { console.error("Device enum error:", e); }
  };

  useEffect(() => {
    getDevices();
    navigator.mediaDevices.ondevicechange = getDevices;
  }, []);

  const handleDeviceChange = async (videoDeviceId, audioDeviceId) => {
    try {
      if (window.localStream) window.localStream.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : video,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : audio
      });
      window.localStream = stream;
      if (localVideoref.current) localVideoref.current.srcObject = stream;
    } catch (e) { console.error("Device switch error:", e); }
  };

  // ── Mic level meter ───────────────────────────────────────────────────────
  useEffect(() => {
    if (askForUsername && audio && window.localStream) {
      try {
        const audioTracks = window.localStream.getAudioTracks();
        if (!audioTracks.length) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx  = new AudioContextClass();
        const analyser  = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let source = audioCtx.createMediaStreamSource(window.localStream);
        if (noiseSuppression) {
          const filter = audioCtx.createBiquadFilter();
          filter.type = "highpass";
          filter.frequency.value = 150;
          source.connect(filter);
          filter.connect(analyser);
        } else {
          source.connect(analyser);
        }
        audioContextRef.current = audioCtx;
        analyserRef.current     = analyser;
        dataArrayRef.current    = dataArray;
        audioSourceRef.current  = source;
        const draw = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArrayRef.current[i];
          setMicLevel(sum / bufferLength);
          animationFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch (err) { console.error("AudioContext error:", err); }
    } else {
      cleanupAudioContext();
    }
    return () => cleanupAudioContext();
  }, [askForUsername, audio, noiseSuppression]);

  const cleanupAudioContext = () => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (audioContextRef.current)   { audioContextRef.current.close(); audioContextRef.current = null; }
    analyserRef.current = null;
  };

  // ── Password validation ───────────────────────────────────────────────────
  const handleValidatePassword = async () => {
    try {
      const res = await axios.post(`${server}/api/v1/users/validate-meeting-password`, {
        meetingCode, password: passwordInput
      });
      if (res.data.valid) {
        setPasswordValid(true);
        setPasswordRequired(false);
        getMedia();
      } else {
        alert("Incorrect meeting password.");
      }
    } catch { alert("Invalid password."); }
  };

  // ── Permissions / media ───────────────────────────────────────────────────
  useEffect(() => { getPermissions(); }, []);

  const getPermissions = async () => {
    try {
      const vp = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoAvailable(!!vp);
      const ap = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioAvailable(!!ap);
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
      if (vp || ap) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: !!vp, audio: !!ap });
        window.localStream = stream;
        if (localVideoref.current) localVideoref.current.srcObject = stream;
      }
    } catch (e) { console.error("Permission error:", e); }
  };

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) getUserMedia();
  }, [video, audio]);

  const getUserMediaSuccess = (stream) => {
    try { window.localStream.getTracks().forEach((t) => t.stop()); } catch {}
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((desc) => {
        connections[id].setLocalDescription(desc).then(() => {
          socketRef.current.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
        });
      });
    }
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false); setAudio(false);
        try { localVideoref.current.srcObject.getTracks().forEach((t) => t.stop()); } catch {}
        const bs = () => new MediaStream([black(), silence()]);
        window.localStream = bs();
        if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
        for (let id in connections) {
          connections[id].addStream(window.localStream);
          connections[id].createOffer().then((desc) => {
            connections[id].setLocalDescription(desc).then(() => {
              socketRef.current.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
            });
          });
        }
      };
    });
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video, audio }).then(getUserMediaSuccess).catch(console.error);
    } else {
      try { localVideoref.current.srcObject.getTracks().forEach((t) => t.stop()); } catch {}
    }
  };

  const getDislayMediaSuccess = (stream) => {
    try { window.localStream.getTracks().forEach((t) => t.stop()); } catch {}
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((desc) => {
        connections[id].setLocalDescription(desc).then(() => {
          socketRef.current.emit("signal", id, JSON.stringify({ sdp: connections[id].localDescription }));
        });
      });
    }
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false);
        try { localVideoref.current.srcObject.getTracks().forEach((t) => t.stop()); } catch {}
        const bs = () => new MediaStream([black(), silence()]);
        window.localStream = bs();
        if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
        getUserMedia();
      };
    });
  };

  const getDislayMedia = () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(getDislayMediaSuccess).catch(console.error);
    }
  };

  useEffect(() => { if (screen !== undefined) getDislayMedia(); }, [screen]);

  // ── WebRTC signal handler ─────────────────────────────────────────────────
  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId === socketIdRef.current) return;
    if (signal.sdp) {
      connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
        if (signal.sdp.type === "offer") {
          connections[fromId].createAnswer().then((desc) => {
            connections[fromId].setLocalDescription(desc).then(() => {
              socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
            });
          });
        }
      });
    }
    if (signal.ice) {
      connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.error);
    }
  };

  // ── Speech recognition ────────────────────────────────────────────────────
  useEffect(() => {
    if (!askForUsername && audio && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.continuous     = true;
      recognition.interimResults = false;
      recognition.lang           = "en-US";
      recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.trim();
        const cmd  = text.toLowerCase();
        if (cmd.includes("mute me"))                { setAudio(false); }
        else if (cmd.includes("unmute me"))         { setAudio(true); }
        else if (cmd.includes("turn on camera"))    { setVideo(true); }
        else if (cmd.includes("turn off camera"))   { setVideo(false); }
        else if (cmd.includes("share screen"))      { handleScreen(); }
        else if (cmd.includes("raise hand"))        { handleRaiseHand(); }
        else if (cmd.includes("open chat"))         { setModal(true); setActiveTab("chat"); }
        else if (cmd.includes("leave meeting"))     { handleEndCall(); }
        if (text && socketRef.current) {
          socketRef.current.emit("transcription-chunk", window.location.pathname, username, text);
        }
      };
      recognition.onerror = (e) => console.error("Speech error:", e);
      recognition.onend   = () => { if (audio && !askForUsername) { try { recognition.start(); } catch {} } };
      try { recognition.start(); recognitionRef.current = recognition; } catch {}
    } else {
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [askForUsername, audio, username]);

  // ── Socket connection ─────────────────────────────────────────────────────
  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      // CRITICAL FIX: send userId (MongoDB _id) alongside username
      // Server uses userId to compare with meeting.hostId for host detection
      socketRef.current.emit(
        "join-call",
        window.location.href,
        username || storedUsername,
        storedUserId   // ← this is the fix: send userId not username for host check
      );
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);
      socketRef.current.on("error-message", (msg) => { setMeetingError(msg); });

      // Waiting room
      socketRef.current.on("waiting-room-joined", () => setInLobby(true));
      socketRef.current.on("waiting-room-list",   (list) => setWaitingList(list));
      socketRef.current.on("lobby-approved",      () => setInLobby(false));
      socketRef.current.on("lobby-rejected",      () => {
        alert("The host declined your join request.");
        navigate("/home");
      });

      // Permissions
      socketRef.current.on("chat-permission-updated",       (d) => setIsChatDisabled(d));
      socketRef.current.on("screenshare-permission-updated",(d) => { setIsScreenShareDisabled(d); if (d) setScreen(false); });
      socketRef.current.on("meeting-lock-updated",          (d) => setIsMeetingLocked(d));
      socketRef.current.on("host-mute-all", () => {
        setAudio(false);
        try { window.localStream.getAudioTracks().forEach((t) => { t.enabled = false; }); } catch {}
      });
      socketRef.current.on("host-removed-you",      () => { alert("You were removed by the host."); navigate("/home"); });
      socketRef.current.on("meeting-ended-by-host", () => { alert("The meeting was ended by the host."); navigate("/home"); });

      // Transcription / captions
      socketRef.current.on("transcription-chunk", (speaker, text) => {
        setTranscripts((p) => [...p, { speaker, text, timestamp: new Date() }]);
        setCaptionText(`${speaker}: "${text}"`);
        setTimeout(() => setCaptionText((p) => (p.startsWith(speaker) ? "" : p)), 4000);
      });

      // Reactions
      socketRef.current.on("user-raised-hand", (id, raised) => setRaisedHands((p) => ({ ...p, [id]: raised })));
      socketRef.current.on("emoji-received",   (emoji, senderName) => triggerFloatingEmoji(emoji, senderName));
      socketRef.current.on("user-left",        (id) => setVideos((v) => v.filter((x) => x.socketId !== id)));

      // User joined — set up WebRTC peer connection
      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit("signal", socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };
          connections[socketListId].onaddstream = (event) => {
            const videoExists = videoRef.current.find((v) => v.socketId === socketListId);
            if (videoExists) {
              setVideos((vs) => {
                const updated = vs.map((v) => v.socketId === socketListId ? { ...v, stream: event.stream } : v);
                videoRef.current = updated;
                return updated;
              });
            } else {
              const newVid = { socketId: socketListId, stream: event.stream, autoplay: true, playsinline: true };
              setVideos((vs) => { const updated = [...vs, newVid]; videoRef.current = updated; return updated; });
            }
          };
          const ls = window.localStream || (() => { const bs = new MediaStream([black(), silence()]); window.localStream = bs; return bs; })();
          connections[socketListId].addStream(ls);
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try { connections[id2].addStream(window.localStream); } catch {}
            connections[id2].createOffer().then((desc) => {
              connections[id2].setLocalDescription(desc).then(() => {
                socketRef.current.emit("signal", id2, JSON.stringify({ sdp: connections[id2].localDescription }));
              });
            });
          }
        }
      });
    });
  };

  const silence = () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const dst = osc.connect(ctx.createMediaStreamDestination());
    osc.start(); ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };
  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    return Object.assign(canvas.captureStream().getVideoTracks()[0], { enabled: false });
  };

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleVideo  = () => setVideo(!video);
  const handleAudio  = () => setAudio(!audio);
  const handleScreen = () => {
    if (isScreenShareDisabled && !isHost) { alert("Screen sharing is disabled by the host."); return; }
    setScreen(!screen);
  };
  const handleEndCall = () => {
    try { localVideoref.current.srcObject.getTracks().forEach((t) => t.stop()); } catch {}
    navigate("/home");
  };

  const connect = () => {
    if (!username.trim()) { alert("Please enter a name."); return; }
    setAskForUsername(false);
  };

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySnackbar(true);
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((p) => [...p, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) setNewMessages((p) => p + 1);
  };

  const sendMessage = () => {
    if (!message || !socketRef.current) return;
    if (isChatDisabled && !isHost) { alert("Chat has been disabled by the host."); return; }
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ── Host actions ──────────────────────────────────────────────────────────
  const handleHostMuteAll          = () => socketRef.current?.emit("mute-everyone", meetingCode);
  const handleHostToggleChat       = () => socketRef.current?.emit("toggle-chat", meetingCode, !isChatDisabled);
  const handleHostToggleScreenShare= () => socketRef.current?.emit("toggle-screenshare", meetingCode, !isScreenShareDisabled);
  const handleHostToggleLock       = () => socketRef.current?.emit("toggle-lock", meetingCode, !isMeetingLocked);
  const handleHostRemove           = (id) => socketRef.current?.emit("remove-participant", meetingCode, id);
  const handleHostEndAll           = () => socketRef.current?.emit("end-meeting-all", meetingCode);
  const handleHostLobbyDecision    = (id, approved) => socketRef.current?.emit("host-decision", meetingCode, id, approved);
  const handleHostApproveAll       = () => socketRef.current?.emit("approve-all", meetingCode);

  // ── Raise hand ────────────────────────────────────────────────────────────
  const handleRaiseHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    socketRef.current?.emit("raise-hand", meetingCode, next);
  };

  // ── Emoji reactions ───────────────────────────────────────────────────────
  const triggerFloatingEmoji = (emoji, senderName = "Guest") => {
    const id = Math.random();
    setFloatingEmojis((p) => [...p, { id, emoji, senderName, left: Math.random() * 60 + 20 }]);
    setTimeout(() => setFloatingEmojis((p) => p.filter((e) => e.id !== id)), 2500);
  };
  const sendEmoji = (emoji) => {
    socketRef.current?.emit("send-emoji", meetingCode, emoji);
    triggerFloatingEmoji(emoji, username || "You");
    resetPickerTimer();
  };
  const resetPickerTimer = () => { clearPickerTimer(); pickerTimerRef.current = setTimeout(() => setShowEmojiPicker(false), 5000); };
  const clearPickerTimer = () => { if (pickerTimerRef.current) { clearTimeout(pickerTimerRef.current); pickerTimerRef.current = null; } };
  const toggleEmojiPicker = () => { const n = !showEmojiPicker; setShowEmojiPicker(n); if (n) resetPickerTimer(); else clearPickerTimer(); };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { setShowEmojiPicker(false); setSettingsOpen(false); setModal(false); setShowPeopleModal(false); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearPickerTimer(); };
  }, []);

  // ── AI assistant ──────────────────────────────────────────────────────────
  const askAIQuestion = async (question) => {
    if (!question.trim()) return;
    setAiLoading(true);
    setAiChatHistory((p) => [...p, { role: "user", text: question }]);
    setAiQuestion("");
    try {
      const res = await axios.post(`${server}/api/v1/users/meeting-assistant`, { meetingCode, question });
      setAiChatHistory((p) => [...p, { role: "ai", text: res.data.answer }]);
    } catch { setAiChatHistory((p) => [...p, { role: "ai", text: "Error connecting to AI service." }]); }
    finally { setAiLoading(false); }
  };

  // ── Invite people ─────────────────────────────────────────────────────────
  const handleSendInvitations = async () => {
    const targets = inviteEmail.trim() ? [inviteEmail, ...selectedSuggestions] : selectedSuggestions;
    if (!targets.length) return;
    try {
      const res = await axios.post(`${server}/api/v1/users/send-invitation`, {
        emails: targets, meetingCode, senderName: username || "A user", isGroupEmail
      });
      if (res.data.previewUrl) alert(`Invitation sent! Preview: ${res.data.previewUrl}`);
      else alert(`Invitation sent to ${targets.join(", ")}`);
      setAddPeopleOpen(false); setInviteEmail(""); setSelectedSuggestions([]);
    } catch (err) { alert(`Error: ${err.response?.data?.message || err.message}`); }
  };

  const downloadTranscript = (format = "txt") => {
    const text = transcripts.map((t) => `[${t.speaker}]: ${t.text}`).join("\n");
    if (format === "txt") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = `transcript_${meetingCode}.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else if (format === "pdf") {
      const w = window.open("", "_blank");
      w.document.write(`<html><body style="font-family:sans-serif;padding:20px"><h1>Transcript — ${meetingCode}</h1><pre>${text}</pre></body></html>`);
      w.document.close(); w.print();
    }
  };

  const getInitials = (name = "") => {
    if (!name.trim()) return "?";
    const parts = name.trim().split(" ");
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  // ── Loading / error screens ───────────────────────────────────────────────
  if (meetingLoading) return (
    <Box sx={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", backgroundColor:"#121212", color:"#fff" }}>
      <CircularProgress size={50} sx={{ color:"#018CCB" }} />
      <Typography variant="body1" sx={{ mt:3, fontWeight:"bold" }}>Verifying meeting...</Typography>
    </Box>
  );

  if (meetingError) return (
    <Box sx={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", backgroundColor:"#121212", color:"#fff", p:3, textAlign:"center" }}>
      <Typography variant="h5" color="error" sx={{ fontWeight:"bold", mb:2 }}>Access Denied</Typography>
      <Typography variant="body1" sx={{ mb:4 }}>{meetingError}</Typography>
      <Button variant="contained" onClick={() => navigate("/home")} sx={{ backgroundColor:"#018CCB" }}>Go to Home</Button>
    </Box>
  );

  if (isExpired) return (
    <Box sx={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", backgroundColor:"#121212", color:"#fff", p:3, textAlign:"center" }}>
      <Typography variant="h4" color="error" sx={{ fontWeight:"bold", mb:2 }}>Meeting Expired</Typography>
      <Typography variant="body1" sx={{ mb:4, color:"#ccc" }}>This meeting link has expired.</Typography>
      <Button variant="contained" onClick={() => navigate("/home")} sx={{ backgroundColor:"#018CCB" }}>Go to Home</Button>
    </Box>
  );

  if (passwordRequired && !passwordValid) return (
    <Box sx={{ display:"flex", justifyContent:"center", alignItems:"center", minHeight:"100vh", backgroundColor:"#121212" }}>
      <Card sx={{ maxWidth:400, width:"100%", p:2, backgroundColor:"#1a1a1a", color:"#fff" }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight:"bold", mb:2, color:"#018CCB" }}>Password Required</Typography>
          <Typography variant="body2" sx={{ mb:3, color:"#ccc" }}>This meeting is password-protected.</Typography>
          <TextField type="password" placeholder="Enter password" fullWidth value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            InputProps={{ style:{ color:"#fff", backgroundColor:"#2b2b2b" } }} sx={{ mb:3 }} />
          <Button variant="contained" fullWidth onClick={handleValidatePassword} sx={{ backgroundColor:"#018CCB" }}>Join</Button>
        </CardContent>
      </Card>
    </Box>
  );

  if (inLobby) return (
    <Box sx={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", minHeight:"100vh", backgroundColor:"#121212", color:"#fff", p:3, textAlign:"center" }}>
      <CircularProgress size={40} sx={{ color:"#018CCB", mb:3 }} />
      <Typography variant="h5" sx={{ fontWeight:"bold", mb:1.5 }}>Waiting for host approval...</Typography>
      <Typography variant="body2" sx={{ color:"#aaa" }}>You will join automatically when approved.</Typography>
      {/* Host waiting room panel */}
      {isHost && waitingList.length > 0 && (
        <Box sx={{ mt:4, maxWidth:400, width:"100%" }}>
          <Typography variant="h6" sx={{ mb:2, color:"#018CCB" }}>Waiting Room ({waitingList.length})</Typography>
          {waitingList.map((p) => (
            <Paper key={p.socketId} sx={{ p:2, mb:1, display:"flex", justifyContent:"space-between", alignItems:"center", backgroundColor:"#1e1e1f" }}>
              <Typography sx={{ color:"#fff" }}>{p.username}</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" sx={{ backgroundColor:"#4caf50" }} onClick={() => handleHostLobbyDecision(p.socketId, true)}>Admit</Button>
                <Button size="small" variant="outlined" color="error" onClick={() => handleHostLobbyDecision(p.socketId, false)}>Deny</Button>
              </Stack>
            </Paper>
          ))}
          <Button variant="outlined" fullWidth sx={{ mt:1, color:"#018CCB", borderColor:"#018CCB" }} onClick={handleHostApproveAll}>Admit All</Button>
        </Box>
      )}
    </Box>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-JOIN SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.pageWrapper}>
      {askForUsername ? (
        <div className={styles.preJoinContainer}>
          {/* Left: camera preview */}
          <div className={styles.preJoinLeft}>
            <div className={styles.preJoinPreview}>
              <video ref={localVideoref} autoPlay muted className={styles.preJoinVideo}
                style={{ filter: backgroundBlur ? "blur(12px)" : "none" }} />
              <div className={styles.preJoinLeftControls}>
                <IconButton onClick={() => setVideo(!video)} style={{ color: video ? "#fff" : "#ff4d4d" }}>
                  {video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <IconButton onClick={() => setAudio(!audio)} style={{ color: audio ? "#fff" : "#ff4d4d" }}>
                  {audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton onClick={() => setBackgroundBlur(!backgroundBlur)} style={{ color: backgroundBlur ? "#018CCB" : "#fff" }} title="Toggle Blur">
                  {backgroundBlur ? <BlurOnIcon /> : <BlurOffIcon />}
                </IconButton>
                <IconButton onClick={() => setNoiseSuppression(!noiseSuppression)} style={{ color: noiseSuppression ? "#018CCB" : "#fff" }} title="Noise Suppression">
                  <HearingIcon />
                </IconButton>
              </div>
            </div>
            {audio && (
              <div className={styles.micIndicatorWrap} style={{ width:"100%", maxWidth:"640px", marginTop:"12px" }}>
                <VolumeUpIcon fontSize="small" style={{ color:"#aaa" }} />
                <div className={styles.micIndicatorTrack}>
                  <div className={styles.micIndicatorFill} style={{ width:`${Math.min(micLevel * 3.5, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Right: join form */}
          <div className={styles.preJoinRight}>
            <h1 className={styles.preJoinTitle}>Ready to join?</h1>
            <p className={styles.preJoinSubtitle}>Enter a display name to join the meeting.</p>
            <TextField label="Your Name" value={username} onChange={(e) => setUsername(e.target.value)}
              variant="outlined" fullWidth
              InputProps={{ style:{ color:"#fff", backgroundColor:"rgba(255,255,255,0.03)" } }} />

            <div className={styles.deviceSelectorCard}>
              <Typography variant="caption" style={{ color:"#aaa", fontWeight:"bold" }}>INPUT DEVICES</Typography>
              <FormControl fullWidth size="small">
                <Select value={selectedVideo} onChange={(e) => { setSelectedVideo(e.target.value); handleDeviceChange(e.target.value, selectedAudio); }}
                  displayEmpty style={{ color:"#fff", backgroundColor:"rgba(0,0,0,0.2)" }}>
                  <MenuItem value="" disabled>Select Camera</MenuItem>
                  {videoDevices.map((d) => <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,5)}`}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <Select value={selectedAudio} onChange={(e) => { setSelectedAudio(e.target.value); handleDeviceChange(selectedVideo, e.target.value); }}
                  displayEmpty style={{ color:"#fff", backgroundColor:"rgba(0,0,0,0.2)" }}>
                  <MenuItem value="" disabled>Select Microphone</MenuItem>
                  {audioDevices.map((d) => <MenuItem key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</MenuItem>)}
                </Select>
              </FormControl>
            </div>

            <div className={styles.joinButtonRow}>
              <Button variant="contained" fullWidth onClick={connect} style={{ backgroundColor:"#018CCB", fontWeight:"bold" }}>Join Now</Button>
              <Button variant="outlined" fullWidth onClick={() => { setVideo(false); connect(); }}
                style={{ borderColor:"#018CCB", color:"#018CCB", fontWeight:"bold" }} startIcon={<PresentToAllIcon />}>
                Present Only
              </Button>
            </div>
            <Button variant="text" fullWidth onClick={() => { setVideo(false); setAudio(false); connect(); }}
              style={{ color:"#aaa", fontSize:"12px", textTransform:"none" }} startIcon={<LaptopIcon />}>
              Companion Mode (No audio/video)
            </Button>

            {/* Host waiting room panel (shown while on pre-join if they submitted already) */}
            {isHost && waitingList.length > 0 && (
              <Box sx={{ mt:2, border:"1px solid #333", borderRadius:"8px", p:2, backgroundColor:"#1e1e1f" }}>
                <Typography variant="subtitle2" sx={{ color:"#018CCB", mb:1.5, fontWeight:"bold" }}>
                  Waiting Room ({waitingList.length})
                </Typography>
                {waitingList.map((p) => (
                  <Box key={p.socketId} sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mb:1 }}>
                    <Typography variant="body2" sx={{ color:"#fff" }}>{p.username}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" sx={{ backgroundColor:"#4caf50", fontSize:"11px" }} onClick={() => handleHostLobbyDecision(p.socketId, true)}>Admit</Button>
                      <Button size="small" variant="outlined" color="error" sx={{ fontSize:"11px" }} onClick={() => handleHostLobbyDecision(p.socketId, false)}>Deny</Button>
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </div>
        </div>
      ) : (

        // ═══════════════════════════════════════════════════════════════════
        // MEETING ROOM
        // ═══════════════════════════════════════════════════════════════════
        <div className={styles.meetContainer}>
          <motion.main className={isFullscreen ? styles.fullscreenMain : styles.mainArea}
            layout transition={{ type:"spring", stiffness:300, damping:30 }}
            style={{ position:"relative", overflow:"hidden", height:"100%", display:"flex", flexDirection:"column" }}>

            {/* Top status bar */}
            <div style={{ position:"absolute", top:24, left:24, right:24, display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:95, pointerEvents:"none" }}>
              <div style={{ display:"flex", gap:"12px", alignItems:"center", pointerEvents:"auto", color:"#fff", fontSize:"14px", fontWeight:500 }}>
                <span>{new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false })}</span>
                <span style={{ opacity:0.5 }}>|</span>
                <span style={{ fontWeight:"bold" }}>{meetingCode}</span>
                <span style={{ opacity:0.5 }}>|</span>
                <span style={{ fontWeight:"bold", color: isHost ? "#4caf50" : "#aaa", fontSize:"12px" }}>
                  {isHost ? "Host" : "Guest"}
                </span>
                <span style={{ fontSize:"12px", color:"#aaa" }}>⏱ {formatDuration(meetingDuration)}</span>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center", pointerEvents:"auto" }}>
                <div onClick={() => { setShowPeopleModal(!showPeopleModal); setModal(false); }}
                  style={{ width:"36px", height:"36px", borderRadius:"50%", backgroundColor:"#e91e63", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"bold", fontSize:"13px", color:"#fff", cursor:"pointer" }}>
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
            </div>

            {/* Video grid */}
            <div className={styles.conferenceWrap}>
              {screen ? (
                <div style={{ display:"flex", width:"100%", height:"100%", gap:"16px" }}>
                  <div style={{ flex:3, position:"relative", borderRadius:"20px", overflow:"hidden", backgroundColor:"#000", border:"2px solid #018CCB" }}>
                    <video ref={localVideoref} autoPlay muted playsInline style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                    <div style={{ position:"absolute", bottom:"12px", left:"12px", backgroundColor:"rgba(0,0,0,0.6)", padding:"6px 12px", borderRadius:"8px", color:"#fff", fontSize:"12px" }}>
                      🖥️ You are presenting
                    </div>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"12px", overflowY:"auto", minWidth:"220px" }}>
                    {videos.map((v) => (
                      <div key={v.socketId} style={{ position:"relative", width:"100%", height:"140px", borderRadius:"20px", overflow:"hidden", backgroundColor:"#1e1e1f" }}>
                        <video ref={(ref) => { if (ref && v.stream) ref.srcObject = v.stream; }} autoPlay playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display:"grid", gap:"12px", width:"100%", height:"100%",
                  gridTemplateColumns: videos.length === 0 ? "1fr" : videos.length === 1 ? "1fr 1fr" : "repeat(auto-fit, minmax(280px, 1fr))" }}>
                  {/* Local tile */}
                  <div style={{ position:"relative", width:"100%", height:"100%", borderRadius:"20px", overflow:"hidden", backgroundColor:"#1e1e1f", border:"1px solid rgba(255,255,255,0.06)" }}>
                    {video ? (
                      <video ref={localVideoref} autoPlay muted playsInline
                        style={{ width:"100%", height:"100%", objectFit:"cover", transform: mirrorMode ? "scaleX(-1)" : "none" }} />
                    ) : (
                      <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#111,#1e1e1f)" }}>
                        <div style={{ width:"80px", height:"80px", borderRadius:"50%", background:"linear-gradient(135deg,#018CCB,#016b9b)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px", fontWeight:"bold", color:"#fff" }}>
                          {getInitials(username)}
                        </div>
                      </div>
                    )}
                    <div style={{ position:"absolute", bottom:"12px", left:"12px", backgroundColor:"rgba(0,0,0,0.5)", padding:"6px 12px", borderRadius:"8px", backdropFilter:"blur(10px)" }}>
                      <span style={{ fontSize:"12px", fontWeight:"bold", color:"#fff" }}>{username || "You"} {isHost ? "(Host)" : ""}</span>
                    </div>
                    {raisedHands[socketIdRef.current] && <div style={{ position:"absolute", top:"12px", right:"12px", fontSize:"24px" }}>✋</div>}
                  </div>
                  {/* Remote tiles */}
                  {videos.map((v) => (
                    <div key={v.socketId} style={{ position:"relative", width:"100%", height:"100%", borderRadius:"20px", overflow:"hidden", backgroundColor:"#1e1e1f", border:"1px solid rgba(255,255,255,0.06)" }}>
                      <video ref={(ref) => { if (ref && v.stream) ref.srcObject = v.stream; }} autoPlay playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      <div style={{ position:"absolute", bottom:"12px", left:"12px", backgroundColor:"rgba(0,0,0,0.5)", padding:"6px 12px", borderRadius:"8px" }}>
                        <span style={{ fontSize:"12px", fontWeight:"bold", color:"#fff" }}>Guest ({v.socketId.slice(0,5)})</span>
                      </div>
                      {raisedHands[v.socketId] && <div style={{ position:"absolute", top:"12px", right:"12px", fontSize:"24px" }}>✋</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating emojis */}
            <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:120, overflow:"hidden" }}>
              {floatingEmojis.map((e) => (
                <div key={e.id} style={{ position:"absolute", bottom:"100px", left:`${e.left}%`, display:"flex", alignItems:"center", gap:"8px", background:"rgba(0,0,0,0.65)", padding:"6px 12px", borderRadius:"20px", color:"#fff", fontSize:"13px", animation:"floatUp 2.5s forwards ease-in-out" }}>
                  <span style={{ fontSize:"22px" }}>{e.emoji}</span>
                  <span style={{ fontSize:"11px", opacity:0.9 }}>{e.senderName}</span>
                </div>
              ))}
            </div>

            {/* Captions */}
            {showCaptions && captionText && (
              <div style={{ position:"absolute", bottom:"110px", left:"50%", transform:"translateX(-50%)", backgroundColor:"rgba(0,0,0,0.75)", color:"#fff", padding:"8px 20px", borderRadius:"8px", fontSize:"15px", zIndex:110, maxWidth:"80%", textAlign:"center" }}>
                {captionText}
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div onMouseEnter={resetPickerTimer} onMouseLeave={resetPickerTimer}
                style={{ position:"absolute", bottom:"85px", left:"50%", transform:"translateX(-50%)", display:"flex", alignItems:"center", gap:"10px", padding:"8px 16px", borderRadius:"9999px", backgroundColor:"rgba(30,30,31,0.9)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.1)", zIndex:105 }}>
                {["❤️","👍","🎉","👏","😂","😮","😢","🤔","👎","🔥","🚀","🙌"].map((emoji) => (
                  <button key={emoji} onClick={() => sendEmoji(emoji)}
                    style={{ background:"none", border:"none", fontSize:"22px", cursor:"pointer", padding:"4px" }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom control bar */}
            <div className={styles.controlBar} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"12px", padding:"10px 24px", borderRadius:"9999px", backgroundColor:"rgba(30,30,31,0.75)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.08)", maxWidth:"fit-content", margin:"0 auto", position:"absolute", bottom:"20px", left:"50%", transform:"translateX(-50%)", zIndex:100 }}>
              {/* Live indicator */}
              <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 10px", borderRadius:"12px", backgroundColor:"rgba(76,175,80,0.15)", color:"#4caf50", fontSize:"11px", fontWeight:"bold" }}>
                <span style={{ width:"6px", height:"6px", borderRadius:"50%", backgroundColor:"#4caf50", display:"inline-block", animation:"bounce 1.5s infinite" }} /> Live
              </div>

              {/* Mic */}
              <div style={{ display:"flex", alignItems:"center" }}>
                <IconButton onClick={handleAudio} style={{ backgroundColor: audio ? "rgba(255,255,255,0.08)" : "#ff4d4d", color:"#fff", width:"44px", height:"44px" }} title={audio ? "Mute" : "Unmute"}>
                  {audio ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton size="small" onClick={(e) => setMicMenuAnchor(e.currentTarget)} style={{ color:"#aaa", marginLeft:"-8px" }}>
                  <span style={{ fontSize:"10px" }}>▼</span>
                </IconButton>
              </div>

              {/* Camera */}
              <div style={{ display:"flex", alignItems:"center" }}>
                <IconButton onClick={handleVideo} style={{ backgroundColor: video ? "rgba(255,255,255,0.08)" : "#ff4d4d", color:"#fff", width:"44px", height:"44px" }} title={video ? "Turn Off Camera" : "Turn On Camera"}>
                  {video ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
                <IconButton size="small" onClick={(e) => setCamMenuAnchor(e.currentTarget)} style={{ color:"#aaa", marginLeft:"-8px" }}>
                  <span style={{ fontSize:"10px" }}>▼</span>
                </IconButton>
              </div>

              {/* Screen share */}
              {screenAvailable && (
                <IconButton onClick={handleScreen} style={{ backgroundColor: screen ? "rgba(1,140,203,0.15)" : "rgba(255,255,255,0.08)", color: screen ? "#018CCB" : "#fff", width:"44px", height:"44px" }} title={screen ? "Stop Sharing" : "Share Screen"}>
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              )}

              {/* Raise hand */}
              <IconButton onClick={handleRaiseHand} style={{ backgroundColor: isHandRaised ? "rgba(1,140,203,0.15)" : "rgba(255,255,255,0.08)", color: isHandRaised ? "#018CCB" : "#fff", width:"44px", height:"44px" }}>
                <span style={{ fontSize:"18px" }}>✋</span>
              </IconButton>

              {/* Captions */}
              <IconButton onClick={() => setShowCaptions(!showCaptions)} style={{ backgroundColor: showCaptions ? "rgba(1,140,203,0.15)" : "rgba(255,255,255,0.08)", color: showCaptions ? "#018CCB" : "#fff", width:"44px", height:"44px" }}>
                <span style={{ fontSize:"14px", fontWeight:"bold" }}>CC</span>
              </IconButton>

              {/* Emoji */}
              <IconButton onClick={toggleEmojiPicker} style={{ backgroundColor: showEmojiPicker ? "rgba(1,140,203,0.15)" : "rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }}>
                <SentimentSatisfiedAltIcon />
              </IconButton>

              {/* Settings */}
              <IconButton onClick={() => setSettingsOpen(true)} style={{ backgroundColor:"rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }}>
                <SettingsIcon />
              </IconButton>

              {/* Fullscreen */}
              <IconButton onClick={() => { if (!isFullscreen) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); setIsFullscreen(!isFullscreen); }}
                style={{ backgroundColor: isFullscreen ? "rgba(1,140,203,0.15)" : "rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }}>
                <span style={{ fontSize:"16px" }}>⛶</span>
              </IconButton>

              {/* More */}
              <IconButton onClick={(e) => setMoreMenuAnchor(e.currentTarget)} style={{ backgroundColor:"rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }}>
                <MoreVertIcon />
              </IconButton>

              {/* End call */}
              <IconButton onClick={handleEndCall} style={{ backgroundColor:"#ff4d4d", color:"#fff", width:"44px", height:"44px" }} title="Leave Meeting">
                <CallEndIcon />
              </IconButton>

              {/* Mic submenu */}
              <Menu anchorEl={micMenuAnchor} open={Boolean(micMenuAnchor)} onClose={() => setMicMenuAnchor(null)} PaperProps={{ style:{ backgroundColor:"#1e1e1f", color:"#fff" } }}>
                <MenuItem disabled style={{ fontSize:"11px", fontWeight:"bold", color:"#888" }}>SELECT MICROPHONE</MenuItem>
                {audioDevices.map((d) => <MenuItem key={d.deviceId} onClick={() => { setSelectedAudio(d.deviceId); handleDeviceChange(selectedVideo, d.deviceId); setMicMenuAnchor(null); }} style={{ fontSize:"13px" }}>{selectedAudio === d.deviceId ? "✓ " : ""}{d.label || `Mic ${d.deviceId.slice(0,5)}`}</MenuItem>)}
                <Divider sx={{ borderColor:"rgba(255,255,255,0.1)" }} />
                <MenuItem onClick={() => { setNoiseSuppression(!noiseSuppression); setMicMenuAnchor(null); }} style={{ fontSize:"13px" }}>{noiseSuppression ? "Disable" : "Enable"} Noise Suppression</MenuItem>
              </Menu>

              {/* Camera submenu */}
              <Menu anchorEl={camMenuAnchor} open={Boolean(camMenuAnchor)} onClose={() => setCamMenuAnchor(null)} PaperProps={{ style:{ backgroundColor:"#1e1e1f", color:"#fff" } }}>
                <MenuItem disabled style={{ fontSize:"11px", fontWeight:"bold", color:"#888" }}>SELECT CAMERA</MenuItem>
                {videoDevices.map((d) => <MenuItem key={d.deviceId} onClick={() => { setSelectedVideo(d.deviceId); handleDeviceChange(d.deviceId, selectedAudio); setCamMenuAnchor(null); }} style={{ fontSize:"13px" }}>{selectedVideo === d.deviceId ? "✓ " : ""}{d.label || `Camera ${d.deviceId.slice(0,5)}`}</MenuItem>)}
                <Divider sx={{ borderColor:"rgba(255,255,255,0.1)" }} />
                <MenuItem onClick={() => { setMirrorMode(!mirrorMode); setCamMenuAnchor(null); }} style={{ fontSize:"13px" }}>{mirrorMode ? "Disable" : "Enable"} Mirror</MenuItem>
              </Menu>

              {/* More options menu */}
              <Menu anchorEl={moreMenuAnchor} open={Boolean(moreMenuAnchor)} onClose={() => setMoreMenuAnchor(null)}
                PaperProps={{ style:{ backgroundColor:"rgba(30,30,31,0.95)", backdropFilter:"blur(20px)", color:"#fff", borderRadius:"16px", border:"1px solid rgba(255,255,255,0.08)", width:"280px", boxShadow:"0 10px 30px rgba(0,0,0,0.5)" } }}>
                <MenuItem disabled style={{ fontSize:"11px", fontWeight:"bold", color:"#018CCB" }}>AI FEATURES</MenuItem>
                <MenuItem onClick={() => { setModal(true); setActiveTab("assistant"); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>🤖 AI Assistant</MenuItem>
                <MenuItem onClick={() => { askAIQuestion("Summarize today's meeting."); setModal(true); setActiveTab("assistant"); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>📝 Generate Summary</MenuItem>
                <MenuItem onClick={() => { downloadTranscript("txt"); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>⬇ Download Transcript</MenuItem>
                <Divider sx={{ borderColor:"rgba(255,255,255,0.08)" }} />
                {isHost && <>
                  <MenuItem disabled style={{ fontSize:"11px", fontWeight:"bold", color:"#018CCB" }}>HOST CONTROLS</MenuItem>
                  <MenuItem onClick={() => { handleHostMuteAll(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>🔇 Mute Everyone</MenuItem>
                  <MenuItem onClick={() => { handleHostToggleChat(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>{isChatDisabled ? "💬 Enable Chat" : "🚫 Disable Chat"}</MenuItem>
                  <MenuItem onClick={() => { handleHostToggleScreenShare(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>{isScreenShareDisabled ? "🖥 Enable Screen Share" : "🚫 Disable Screen Share"}</MenuItem>
                  <MenuItem onClick={() => { handleHostToggleLock(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>{isMeetingLocked ? "🔓 Unlock Meeting" : "🔒 Lock Meeting"}</MenuItem>
                  <MenuItem onClick={() => { handleHostEndAll(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px", color:"#ff4d4d" }}>⏹ End for Everyone</MenuItem>
                  <Divider sx={{ borderColor:"rgba(255,255,255,0.08)" }} />
                </>}
                <MenuItem disabled style={{ fontSize:"11px", fontWeight:"bold", color:"#018CCB" }}>MEETING</MenuItem>
                <MenuItem onClick={() => { copyMeetingCode(); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>🔗 Copy Meeting Link</MenuItem>
                <MenuItem onClick={() => { setSettingsOpen(true); setMoreMenuAnchor(null); }} style={{ fontSize:"13px" }}>⚙ Settings</MenuItem>
              </Menu>
            </div>

            {/* Bottom-right: chat + copy */}
            <div style={{ position:"absolute", bottom:"20px", right:"24px", display:"flex", gap:"12px", zIndex:100 }}>
              <IconButton onClick={() => { setModal(!showModal); if (!showModal) setNewMessages(0); }}
                style={{ backgroundColor: showModal ? "rgba(1,140,203,0.25)" : "rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }}>
                <Badge badgeContent={newMessages} color="error"><ChatIcon /></Badge>
              </IconButton>
              <IconButton onClick={copyMeetingCode} style={{ backgroundColor:"rgba(255,255,255,0.08)", color:"#fff", width:"44px", height:"44px" }} title="Copy link">
                <ContentCopyIcon />
              </IconButton>
            </div>
          </motion.main>
