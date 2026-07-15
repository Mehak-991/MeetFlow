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
  Paper
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
  const [password, setPassword] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [recurring, setRecurring] = useState(false);

  // Invite states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  const handleCreateInstantMeeting = async () => {
    try {
      const token = localStorage.getItem("token");
      // Instant meeting: 24h expiration, no password, waiting room disabled
      const res = await client.post("/create-scheduled-meeting", {
        token,
        expiresAtChoice: "24h",
        password: "",
        waitingRoomEnabled: false
      });
      await addToUserHistory(res.data.meetingCode);
      navigate(`/${res.data.meetingCode}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to create instant meeting.");
    }
  };

  const handleCreateScheduledMeeting = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await client.post("/create-scheduled-meeting", {
        token,
        expiresAtChoice: recurring ? "never" : expiry,
        password,
        waitingRoomEnabled: waitingRoom
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
    const title = `MeetFlow Meeting - ${code}`;
    const description = `Join the meeting at: ${window.location.origin}/${code}`;
    const now = new Date();
    const startDateStr = now.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endDateStr = new Date(now.getTime() + 60 * 60000).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${title}
DESCRIPTION:${description}
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
    const link = `${window.location.origin}/${createdMeeting.meetingCode}`;
    const text = `Join my MeetFlow Meeting!\n\nLink: ${link}\nMeeting Code: ${createdMeeting.meetingCode}${createdMeeting.meetingPassword ? `\nPassword: ${createdMeeting.meetingPassword}` : ''}`;
    navigator.clipboard.writeText(text);
    showToast("Invitation copied to clipboard!");
  };

  const handleEmailInvite = () => {
    if (!createdMeeting) return;
    const link = `${window.location.origin}/${createdMeeting.meetingCode}`;
    const subject = encodeURIComponent("MeetFlow Meeting Invitation");
    const body = encodeURIComponent(`Hello,\n\nPlease join my MeetFlow Meeting.\n\nLink: ${link}\nMeeting Code: ${createdMeeting.meetingCode}${createdMeeting.meetingPassword ? `\nPassword: ${createdMeeting.meetingPassword}` : ''}\n\nSee you there!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
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
        <Stack direction="row" spacing={3} alignItems="center">
          <IconButton onClick={toggleTheme} sx={{ color: darkMode ? "#e0e0e0" : "#333" }}>
            {darkMode ? <MdLightMode size={24} /> : <MdDarkMode size={24} />}
          </IconButton>
          
          <Button
            onClick={() => navigate("/insights")}
            startIcon={<BarChartIcon />}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500 }}
          >
            Insights
          </Button>

          <Button
            onClick={() => navigate("/history")}
            startIcon={<RestoreIcon />}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500 }}
          >
            History
          </Button>

          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{ color: darkMode ? "#e0e0e0" : "#333", textTransform: "none", fontWeight: 500 }}
          >
            Logout
          </Button>
        </Stack>
      </Box>

      {/* Main Google Meet Styled Layout */}
      <Grid container sx={{ flexGrow: 1, p: { xs: 4, md: 8 }, alignItems: "center" }} spacing={6}>
        <Grid item xs={12} md={6}>
          <Box sx={{ maxWidth: "520px" }}>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 2, fontSize: { xs: "2.2rem", md: "2.8rem" }, color: "#018CCB" }}>
              Premium video meetings. Now free for everyone.
            </Typography>
            <Typography variant="body1" sx={{ color: darkMode ? "#b0b0b0" : "#5f6368", mb: 5, fontSize: "1.1rem", lineHeight: 1.6 }}>
              We re-engineered MeetFlow to deliver production-grade meeting intelligence, real-time speech transcription, vector RAG search, and scheduling.
            </Typography>

            {/* Meet buttons */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 4 }}>
              <Button
                variant="contained"
                startIcon={<VideoCallIcon />}
                onClick={() => setSchedulerOpen(true)}
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
      <Dialog open={schedulerOpen} onClose={() => setSchedulerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold", color: "#018CCB" }}>Schedule a New Meeting</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1.5 }}>
            <FormControlLabel
              control={<Checkbox checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />}
              label="Recurring Meeting (Never Expires)"
            />

            {!recurring && (
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
                </Select>
              </FormControl>
            )}

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

      {/* Share / Invite Modal */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        {createdMeeting && (
          <>
            <DialogTitle sx={{ fontWeight: "bold", color: "#018CCB" }}>Here's your meeting link</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Copy this link and send it to people you want to meet with. Make sure to note down the password if you set one.
              </Typography>

              <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 1, backgroundColor: "#f5f5f5", border: "1px dashed #ccc", mb: 3 }}>
                <Typography sx={{ flexGrow: 1, fontWeight: "bold", fontFamily: "monospace" }}>
                  {window.location.origin}/{createdMeeting.meetingCode}
                </Typography>
                <IconButton onClick={handleCopyInvite} size="small" sx={{ backgroundColor: "#e0e0e0" }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Paper>

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
              <Button onClick={() => {
                setInviteOpen(false);
                navigate(`/${createdMeeting.meetingCode}`);
              }} variant="contained" sx={{ backgroundColor: "#018CCB" }}>
                Join Meeting Now
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
