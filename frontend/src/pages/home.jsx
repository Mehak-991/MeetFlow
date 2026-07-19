import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Grid,
  Typography,
  Box,
  Divider,
  Stack,
  IconButton,
  Paper,
  Menu
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import BarChartIcon from "@mui/icons-material/BarChart";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import { MdLightMode, MdDarkMode } from "react-icons/md";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import server from "../environment";

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const { addToUserHistory } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useTheme();

  // Create meeting states
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [expiry, setExpiry] = useState("2h");
  const [customDate, setCustomDate] = useState("");
  const [password, setPassword] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [recurring, setRecurring] = useState(false);

  // New scheduler details
  const [meetingTitle, setMeetingTitle] = useState("");
  const [description, setDescription] = useState("");
  const [guests, setGuests] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  // Dropdown anchor
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Invite success states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  const handleOpenDropdown = (event) => setMenuAnchor(event.currentTarget);
  const handleCloseDropdown = () => setMenuAnchor(null);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;
    let cleanCode = meetingCode.trim();
    // Strip any URL prefix to extract the bare meeting code
    if (cleanCode.includes("/meeting/")) {
      cleanCode = cleanCode.split("/meeting/")[1];
    } else if (cleanCode.includes("/")) {
      cleanCode = cleanCode.substring(cleanCode.lastIndexOf("/") + 1);
    }
    cleanCode = cleanCode.split("?")[0].split("#")[0]; // strip query/hash
    await addToUserHistory(cleanCode);
    navigate(`/meeting/${cleanCode}`);
  };

  const handleCreateInstantMeeting = async () => {
    handleCloseDropdown();
    try {
      const token = localStorage.getItem("token");
      const res = await client.post("/create-scheduled-meeting", {
        token,
        expiresAtChoice: "24h",
        password: "",
        waitingRoomEnabled: false,
        meetingTitle: "Instant MeetFlow Call",
        description: "Created instantly via dashboard."
      });
      await addToUserHistory(res.data.meetingCode);
      navigate(`/meeting/${res.data.meetingCode}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to create instant meeting.");
    }
  };

  const handleCreateMeetingLink = async () => {
    handleCloseDropdown();
    try {
      const token = localStorage.getItem("token");
      const res = await client.post("/create-scheduled-meeting", {
        token,
        expiresAtChoice: "24h",
        password: "",
        waitingRoomEnabled: false,
        meetingTitle: "Quick Meeting Link",
        description: "Shared quickly via dashboard."
      });
      setCreatedMeeting(res.data);
      setInviteOpen(true);
      await addToUserHistory(res.data.meetingCode);
    } catch (err) {
      console.error(err);
      showToast("Failed to generate meeting link.");
    }
  };

  const handleCreateScheduledMeeting = async () => {
    try {
      const token = localStorage.getItem("token");
      const expiryChoice = recurring ? "never" : (customDate ? customDate : expiry);
      const res = await client.post("/create-scheduled-meeting", {
        token,
        expiresAtChoice: expiryChoice,
        password,
        waitingRoomEnabled: waitingRoom,
        meetingTitle: meetingTitle || "Scheduled MeetFlow Meeting",
        description,
        attendeeEmails: guests ? guests.split(",").map((e) => e.trim()).filter(Boolean) : []
      });
      setCreatedMeeting(res.data);
      setSchedulerOpen(false);
      setInviteOpen(true);
      await addToUserHistory(res.data.meetingCode);
    } catch (err) {
      console.error(err);
      showToast("Failed to schedule meeting.");
    }
  };

  const generateICS = () => {
    if (!createdMeeting) return;
    const code = createdMeeting.meetingCode;
    const title = createdMeeting.meetingTitle || `MeetFlow Meeting - ${code}`;
    const desc = createdMeeting.description || `Join the meeting at: ${window.location.origin}/${code}`;
    const now = new Date();
    const startDateStr = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endDateStr = new Date(now.getTime() + 60 * 60000).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${title}
DESCRIPTION:${desc}
DTSTART:${startDateStr}
DTEND:${endDateStr}
LOCATION:${window.location.origin}/${code}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `meeting_${code}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyInvite = () => {
    if (!createdMeeting) return;
    const link = `${window.location.origin}/meeting/${createdMeeting.meetingCode}`;
    const text = `Join my MeetFlow Meeting!\n\nLink: ${link}\nMeeting Code: ${createdMeeting.meetingCode}`;
    navigator.clipboard.writeText(text);
    showToast("Invitation copied to clipboard!");
  };

  const handleEmailInvite = () => {
    if (!createdMeeting) return;
    const link = `${window.location.origin}/meeting/${createdMeeting.meetingCode}`;
    const subject = encodeURIComponent(`Invitation: ${createdMeeting.meetingTitle || "MeetFlow Meeting"}`);
    const body = encodeURIComponent(`Hello,\n\nPlease join my MeetFlow Meeting.\n\nLink: ${link}\nMeeting Code: ${createdMeeting.meetingCode}${createdMeeting.meetingPassword ? `\nPassword: ${createdMeeting.meetingPassword}` : ''}\n\nSee you there!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareSocial = (platform) => {
    if (!createdMeeting) return;
    const link = encodeURIComponent(`${window.location.origin}/meeting/${createdMeeting.meetingCode}`);
    const text = encodeURIComponent(`Join my MeetFlow AI Meeting: ${createdMeeting.meetingTitle || ''}`);
    let url = "";

    if (platform === "whatsapp") {
      url = `https://api.whatsapp.com/send?text=${text}%20${link}`;
    } else if (platform === "telegram") {
      url = `https://t.me/share/url?url=${link}&text=${text}`;
    } else if (platform === "linkedin") {
      url = `https://www.linkedin.com/sharing/share-offsite/?url=${link}`;
    }
    
    if (url) window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (!createdMeeting) return;
    const link = `${window.location.origin}/meeting/${createdMeeting.meetingCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: createdMeeting.meetingTitle || "MeetFlow Meeting",
          text: `Join my MeetFlow Meeting!`,
          url: link
        });
      } catch (err) {
        console.error("Native share failed:", err);
      }
    } else {
      handleCopyInvite();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("name");
    navigate("/auth");
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastOpen(true);
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: darkMode ? "#121212" : "#ffffff", color: darkMode ? "#fff" : "#1a1a1a", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 30px",
          backgroundColor: darkMode ? "#1a1a1a" : "white",
          boxShadow: darkMode ? "0px 2px 6px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/erasebg-transformed (1).png"
            alt="Logo"
            style={{ height: "110px", cursor: "pointer" }}
            onClick={() => navigate("/")}
          />
        </Box>

        {/* Navigation Items */}
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={toggleTheme} sx={{ color: darkMode ? "#e0e0e0" : "#333" }}>
            {darkMode ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
          </IconButton>
          
          <Button
            onClick={() => navigate("/home")}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            Dashboard
          </Button>

          <Button
            onClick={() => setSchedulerOpen(true)}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            Meetings
          </Button>

          <Button
            onClick={() => navigate("/insights")}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            AI Assistant
          </Button>

          <Button
            onClick={() => navigate("/history")}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            History
          </Button>

          <Button
            onClick={() => navigate("/insights")}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            Analytics
          </Button>

          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500, fontSize: "14px" }}
          >
            Logout
          </Button>
        </Stack>
      </Box>

      {/* Main Google Meet Styled Layout */}
      <Grid container sx={{ flexGrow: 1, p: { xs: 4, md: 8 }, alignItems: "center" }} spacing={6}>
        <Grid item xs={12} md={6}>
          <Box sx={{ maxWidth: "520px" }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: "2.2rem", md: "2.9rem" }, color: "#018CCB" }}>
              Video meetings powered by AI
            </Typography>
            <Typography variant="body1" sx={{ color: darkMode ? "#b0b0b0" : "#5f6368", mb: 5, fontSize: "1.1rem", lineHeight: 1.6 }}>
              We re-engineered MeetFlow to deliver production-grade meeting intelligence, real-time speech transcription, vector RAG search, and scheduling.
            </Typography>

            {/* Meet buttons */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 4 }}>
              <Button
                variant="contained"
                startIcon={<VideoCallIcon />}
                onClick={handleOpenDropdown}
                sx={{
                  backgroundColor: "#018CCB",
                  padding: "12px 24px",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  textTransform: "none",
                  ":hover": { backgroundColor: "#0179b0" }
                }}
              >
                New Meeting
              </Button>

              {/* NEW MEETING DROPDOWN */}
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseDropdown}
                PaperProps={{
                  style: {
                    backgroundColor: darkMode ? "#222" : "#fff",
                    color: darkMode ? "#fff" : "#333",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px"
                  }
                }}
              >
                <MenuItem onClick={handleCreateMeetingLink}>🔗 Create Meeting Link</MenuItem>
                <MenuItem onClick={handleCreateInstantMeeting}>⚡ Start Instant Meeting</MenuItem>
                <MenuItem onClick={() => { setSchedulerOpen(true); setRecurring(false); handleCloseDropdown(); }}>📅 Schedule Meeting</MenuItem>
                <MenuItem onClick={() => { setSchedulerOpen(true); setRecurring(true); handleCloseDropdown(); }}>🔄 Create Recurring Meeting</MenuItem>
              </Menu>

              <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
                <TextField
                  placeholder="Enter code or link"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleJoinVideoCall()}
                  size="small"
                  InputProps={{
                    startAdornment: <KeyboardIcon sx={{ color: "gray", mr: 1 }} />
                  }}
                  sx={{
                    flexGrow: 1,
                    input: { color: darkMode ? "#fff" : "#333" },
                    backgroundColor: darkMode ? "#2a2a2a" : "#fff",
                    borderRadius: "4px"
                  }}
                />
                <Button
                  onClick={handleJoinVideoCall}
                  disabled={!meetingCode.trim()}
                  sx={{
                    color: "#018CCB",
                    fontWeight: "bold",
                    textTransform: "none"
                  }}
                >
                  Join
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ my: 3 }} />
            <Button
              variant="text"
              startIcon={<VideoCallIcon />}
              onClick={handleCreateInstantMeeting}
              sx={{ color: "#018CCB", textTransform: "none", fontWeight: "bold" }}
            >
              Start an instant meeting
            </Button>
          </Box>
        </Grid>

        {/* Right side illustration card */}
        <Grid item xs={12} md={6} sx={{ display: "flex", justifyContent: "center" }}>
          <Box sx={{ textAlign: "center", maxWidth: "450px" }}>
            <img
              src="/logo3-Photoroom.png"
              alt="Google Meet Platform illustration"
              style={{ width: "100%", height: "auto", borderRadius: "12px", opacity: darkMode ? 0.9 : 1 }}
            />
            <Typography variant="h6" sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>
              Get a link you can share
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Click <strong>New Meeting</strong> to get a link you can copy and schedule for external participants.
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Scheduler Modal */}
      <Dialog open={schedulerOpen} onClose={() => setSchedulerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold", color: "#018CCB" }}>Schedule a New Meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Meeting Name / Title"
              fullWidth
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g. Weekly Sync"
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. AI project status alignment."
            />

            <FormControlLabel
              control={<Checkbox checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />}
              label="Recurring Meeting (Never Expires)"
            />

            {!recurring && (
              <>
                <FormControl fullWidth>
                  <InputLabel id="expiry-label">Meeting Expiration</InputLabel>
                  <Select
                    labelId="expiry-label"
                    value={expiry}
                    label="Meeting Expiration"
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    <MenuItem value="30m">30 Minutes</MenuItem>
                    <MenuItem value="1h">1 Hour</MenuItem>
                    <MenuItem value="2h">2 Hours</MenuItem>
                    <MenuItem value="6h">6 Hours</MenuItem>
                    <MenuItem value="24h">24 Hours</MenuItem>
                    <MenuItem value="custom">Custom Date & Time</MenuItem>
                  </Select>
                </FormControl>

                {expiry === "custom" && (
                  <TextField
                    label="Select Expiration Date & Time"
                    type="datetime-local"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                )}
              </>
            )}

            <TextField
              label="Guest Email Invites (Comma separated)"
              fullWidth
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="user1@domain.com, user2@domain.com"
            />

            <FormControl fullWidth>
              <InputLabel id="timezone-label">Timezone</InputLabel>
              <Select
                labelId="timezone-label"
                value={timezone}
                label="Timezone"
                onChange={(e) => setTimezone(e.target.value)}
              >
                <MenuItem value="UTC">UTC (Coordinated Universal Time)</MenuItem>
                <MenuItem value="America/New_York">America/New_York (EST)</MenuItem>
                <MenuItem value="Europe/London">Europe/London (GMT)</MenuItem>
                <MenuItem value="Asia/Kolkata">Asia/Kolkata (IST)</MenuItem>
                <MenuItem value="Asia/Tokyo">Asia/Tokyo (JST)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Optional Password"
              placeholder="Leave empty for none"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <FormControlLabel
              control={<Checkbox checked={waitingRoom} onChange={(e) => setWaitingRoom(e.target.checked)} />}
              label="Enable waiting room lobby (Host approves joins)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSchedulerOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateScheduledMeeting} variant="contained" sx={{ backgroundColor: "#018CCB" }}>
            Create Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share / Invite Success Modal */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        {createdMeeting && (
          <>
            <DialogTitle sx={{ fontWeight: "bold", color: "#018CCB" }}>Here's your meeting details</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Copy this link and send it to people you want to meet with. Make sure to note down the password if you set one.
              </Typography>

              <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                Title: {createdMeeting.meetingTitle || "MeetFlow AI Call"}
              </Typography>
              {createdMeeting.expiresAt ? (
                <Typography variant="caption" color="error" sx={{ display: "block", mb: 2 }}>
                  Expires At: {new Date(createdMeeting.expiresAt).toLocaleString()}
                </Typography>
              ) : (
                <Typography variant="caption" color="success" sx={{ display: "block", mb: 2 }}>
                  Never Expires (Recurring)
                </Typography>
              )}

              <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 1, backgroundColor: "#f5f5f5", border: "1px dashed #ccc", mb: 3 }}>
                <Typography sx={{ flexGrow: 1, fontWeight: "bold", fontFamily: "monospace", color: "#333", wordBreak: "break-all" }}>
                  {window.location.origin}/meeting/{createdMeeting.meetingCode}
                </Typography>
                <IconButton onClick={handleCopyInvite} size="small" sx={{ backgroundColor: "#e0e0e0" }} title="Copy Link">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Paper>

              {/* QUICK SHARE ACTIONS */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>Share Invitation</Typography>
              <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" onClick={() => shareSocial("whatsapp")} sx={{ textTransform: "none", color: "#25d366", borderColor: "#25d366" }}>
                  WhatsApp
                </Button>
                <Button size="small" variant="outlined" onClick={() => shareSocial("telegram")} sx={{ textTransform: "none", color: "#0088cc", borderColor: "#0088cc" }}>
                  Telegram
                </Button>
                <Button size="small" variant="outlined" onClick={() => shareSocial("linkedin")} sx={{ textTransform: "none", color: "#0077b5", borderColor: "#0077b5" }}>
                  LinkedIn
                </Button>
                <Button size="small" variant="outlined" onClick={handleNativeShare} sx={{ textTransform: "none", color: "#018CCB", borderColor: "#018CCB" }}>
                  System Share
                </Button>
              </Box>

              <Stack direction="row" spacing={2}>
                <Button variant="outlined" fullWidth startIcon={<FileDownloadIcon />} onClick={generateICS}>
                  Add to Calendar (.ics)
                </Button>
                <Button variant="outlined" fullWidth startIcon={<MailOutlineIcon />} onClick={handleEmailInvite}>
                  Email Invitation
                </Button>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                setInviteOpen(false);
                navigate(`/meeting/${createdMeeting.meetingCode}`);
              }} variant="contained" sx={{ backgroundColor: "#018CCB" }}>
                Open Meeting
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default withAuth(HomeComponent);
