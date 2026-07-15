import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Button,
  Stack,
  Drawer,
  Tabs,
  Tab,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Chip,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Grid
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import server from "../environment";

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

export default function History() {
  const { getHistoryOfUser } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const routeTo = useNavigate();

  // Selected meeting state
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: Summary, 1: Assistant, 2: Tasks, 3: Analytics

  // AI data loading states
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Q&A assistant state
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [answering, setAnswering] = useState(false);

  // Edit task state
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

  const fetchHistory = async () => {
    try {
      const history = await getHistoryOfUser();
      setMeetings(history);
    } catch {
      console.error("Failed to fetch history");
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getHistoryOfUser]);

  const handleMeetingClick = async (meeting) => {
    setSelectedMeeting(meeting);
    setDrawerOpen(true);
    setActiveTab(0);
    setChatHistory([]);
    setQuestion("");
    loadAIData(meeting.meetingCode);
  };

  const loadAIData = async (meetingCode) => {
    setAiLoading(true);
    try {
      // Fetch summary
      const sumRes = await client.get("/meeting-summary", { params: { meetingCode } });
      setSummary(sumRes.data?._id ? sumRes.data : null);

      // Fetch tasks
      const taskRes = await client.get("/meeting-tasks", { params: { meetingCode } });
      setTasks(taskRes.data);

      // Fetch analytics
      const analRes = await client.get("/meeting-analytics", { params: { meetingCode } });
      setAnalytics(analRes.data?._id ? analRes.data : null);
    } catch (err) {
      console.error("Failed to load AI data:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleTriggerAI = async () => {
    if (!selectedMeeting) return;
    setAiLoading(true);
    try {
      await client.post("/trigger-ai", { meetingCode: selectedMeeting.meetingCode });
      loadAIData(selectedMeeting.meetingCode);
    } catch (err) {
      alert("No transcript exists for this meeting, or transcription has not been generated.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedMeeting) return;
    const currentQuestion = question;
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", text: currentQuestion }]);
    setAnswering(true);
    try {
      const res = await client.post("/meeting-assistant", {
        meetingCode: selectedMeeting.meetingCode,
        question: currentQuestion,
      });
      setChatHistory((prev) => [...prev, { role: "assistant", text: res.data.answer }]);
    } catch (error) {
      setChatHistory((prev) => [...prev, { role: "assistant", text: "Error fetching answer." }]);
    } finally {
      setAnswering(false);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const updated = { ...task, completed: !task.completed };
      const res = await client.put(`/meeting-tasks/${task._id}`, updated);
      setTasks(tasks.map((t) => (t._id === task._id ? res.data : t)));
    } catch (error) {
      console.error("Failed to toggle task status:", error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await client.delete(`/meeting-tasks/${taskId}`);
      setTasks(tasks.filter((t) => t._id !== taskId));
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updated = {
        ...editingTask,
        task: editTaskText,
        assignedTo: editOwner,
        deadline: editDeadline
      };
      const res = await client.put(`/meeting-tasks/${editingTask._id}`, updated);
      setTasks(tasks.map((t) => (t._id === editingTask._id ? res.data : t)));
      setEditingTask(null);
    } catch (error) {
      console.error("Failed to edit task:", error);
    }
  };

  // Export Summary PDF/TXT/Markdown
  const exportSummary = (format) => {
    if (!summary) return;
    const title = `Meeting Summary - ${selectedMeeting.meetingCode}`;
    const date = formatDate(selectedMeeting.date);
    
    const bodyContent = `
Executive Summary:
${summary.executiveSummary}

Key Discussion Points:
${summary.keyDiscussionPoints.map(p => `- ${p}`).join("\n")}

Decisions Taken:
${summary.decisionsTaken.map(d => `- ${d}`).join("\n")}

Risks:
${summary.risks.map(r => `- ${r}`).join("\n")}

Action Items:
${summary.actionItems.map(a => `- ${a}`).join("\n")}

Next Steps:
${summary.nextSteps.map(n => `- ${n}`).join("\n")}
`;

    if (format === "txt") {
      const element = document.createElement("a");
      const file = new Blob([bodyContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${title}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === "md") {
      const mdContent = `# ${title}\n**Date**: ${date}\n\n## Executive Summary\n${summary.executiveSummary}\n\n## Key Discussion Points\n${summary.keyDiscussionPoints.map(p => `* ${p}`).join("\n")}\n\n## Decisions Taken\n${summary.decisionsTaken.map(d => `* ${d}`).join("\n")}\n\n## Risks\n${summary.risks.map(r => `* ${r}`).join("\n")}\n\n## Action Items\n${summary.actionItems.map(a => `* ${a}`).join("\n")}\n\n## Next Steps\n${summary.nextSteps.map(n => `* ${n}`).join("\n")}`;
      const element = document.createElement("a");
      const file = new Blob([mdContent], { type: 'text/markdown' });
      element.href = URL.createObjectURL(file);
      element.download = `${title}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === "pdf") {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 30px; line-height: 1.6; color: #333; }
              h1 { color: #018CCB; border-bottom: 2px solid #018CCB; padding-bottom: 10px; margin-bottom: 20px; }
              h2 { color: #333; margin-top: 25px; font-size: 1.3rem; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              p, li { font-size: 0.95rem; }
              ul { padding-left: 20px; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p><strong>Date:</strong> ${date}</p>
            <h2>Executive Summary</h2>
            <p>${summary.executiveSummary}</p>
            <h2>Key Discussion Points</h2>
            <ul>${summary.keyDiscussionPoints.map(p => `<li>${p}</li>`).join("")}</ul>
            <h2>Decisions Taken</h2>
            <ul>${summary.decisionsTaken.map(d => `<li>${d}</li>`).join("")}</ul>
            <h2>Risks</h2>
            <ul>${summary.risks.map(r => `<li>${r}</li>`).join("")}</ul>
            <h2>Action Items</h2>
            <ul>${summary.actionItems.map(a => `<li>${a}</li>`).join("")}</ul>
            <h2>Next Steps</h2>
            <ul>${summary.nextSteps.map(n => `<li>${n}</li>`).join("")}</ul>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <Box sx={{ backgroundColor: "#f8f9fa", minHeight: "100vh", padding: "30px" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <HistoryIcon sx={{ color: "#018CCB", fontSize: 30 }} />
          <Typography variant="h5" sx={{ color: "#018CCB", fontWeight: "600", letterSpacing: "0.5px" }}>
            Meeting History
          </Typography>
        </Box>

        <IconButton
          onClick={() => routeTo("/home")}
          sx={{
            backgroundColor: "#018CCB",
            color: "white",
            "&:hover": { backgroundColor: "#0179b0" },
          }}
        >
          <HomeIcon />
        </IconButton>
      </Box>

      {/* Meeting Cards List */}
      {meetings.length > 0 ? (
        <Stack spacing={2} sx={{ maxWidth: "700px", margin: "0 auto" }}>
          {meetings.map((meeting, index) => (
            <Card
              key={index}
              variant="outlined"
              onClick={() => handleMeetingClick(meeting)}
              sx={{
                borderRadius: "12px",
                transition: "0.3s",
                padding: "12px",
                cursor: "pointer",
                border: "1px solid #e0e0e0",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: "0px 4px 15px rgba(0,0,0,0.1)",
                  borderColor: "#018CCB"
                },
              }}
            >
              <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Meeting Code
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#018CCB", fontWeight: "bold" }}>
                    {meeting.meetingCode}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                    Date: {formatDate(meeting.date)}
                  </Typography>
                </Box>
                <Chip label="View Intelligence" color="primary" variant="outlined" size="small" />
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Box sx={{ textAlign: "center", mt: 10, color: "gray" }}>
          <Typography variant="h6" gutterBottom>
            No Meeting History Found
          </Typography>
          <Typography variant="body2">
            Join or create a meeting to see your history here.
          </Typography>
          <Button
            variant="contained"
            sx={{
              mt: 3,
              backgroundColor: "#018CCB",
              ":hover": { backgroundColor: "#0179b0" },
            }}
            onClick={() => routeTo("/home")}
          >
            Go to Home
          </Button>
        </Box>
      )}

      {/* SIDE DRAWER FOR MEETING INTELLIGENCE */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: "100%", sm: "600px" }, padding: "20px" },
        }}
      >
        {selectedMeeting && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Drawer Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: "bold", color: "#018CCB" }}>
                  Meeting: {selectedMeeting.meetingCode}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Date: {formatDate(selectedMeeting.date)}
                </Typography>
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider />

            {/* AI Process trigger if no summary exists */}
            {!aiLoading && !summary && (
              <Paper sx={{ p: 2, my: 2, backgroundColor: "#fffde7", border: "1px solid #fff59d" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>AI analysis hasn't run yet</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
                  We can analyze the meeting transcript to extract summary, action items, owner tasks, and speaker analytics.
                </Typography>
                <Button size="small" variant="contained" startIcon={<RefreshIcon />} onClick={handleTriggerAI} sx={{ backgroundColor: "#018CCB" }}>
                  Run AI Intelligence
                </Button>
              </Paper>
            )}

            {aiLoading ? (
              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 2 }} color="textSecondary">
                  AI is analyzing meeting transcript and generating insights...
                </Typography>
              </Box>
            ) : (
              <>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tab label="Summary" />
                  <Tab label="Ask AI" />
                  <Tab label="Tasks" />
                  <Tab label="Analytics" />
                </Tabs>

                {/* Tab content wrapper */}
                <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
                  
                  {/* SUMMARY TAB */}
                  {activeTab === 0 && (
                    <Box>
                      {summary ? (
                        <>
                          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                            <Button size="small" variant="outlined" onClick={() => exportSummary("txt")} startIcon={<DownloadIcon />}>TXT</Button>
                            <Button size="small" variant="outlined" onClick={() => exportSummary("md")} startIcon={<DownloadIcon />}>Markdown</Button>
                            <Button size="small" variant="contained" onClick={() => exportSummary("pdf")} startIcon={<DownloadIcon />} sx={{ backgroundColor: "#018CCB" }}>PDF</Button>
                          </Box>

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#333", mt: 2 }}>Executive Summary</Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                            {summary.executiveSummary}
                          </Typography>

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#333", mt: 3 }}>Key Discussion Points</Typography>
                          <List dense>
                            {summary.keyDiscussionPoints.map((item, i) => (
                              <ListItem key={i} sx={{ pl: 0 }}><ListItemText primary={`• ${item}`} /></ListItem>
                            ))}
                          </List>

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#333", mt: 2 }}>Decisions Taken</Typography>
                          <List dense>
                            {summary.decisionsTaken.map((item, i) => (
                              <ListItem key={i} sx={{ pl: 0 }}><ListItemText primary={`✔ ${item}`} /></ListItem>
                            ))}
                          </List>

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#333", mt: 2 }}>Risks Identified</Typography>
                          <List dense>
                            {summary.risks.map((item, i) => (
                              <ListItem key={i} sx={{ pl: 0 }}><ListItemText primary={`⚠ ${item}`} /></ListItem>
                            ))}
                          </List>
                        </>
                      ) : (
                        <Typography color="textSecondary" variant="body2">No summary available.</Typography>
                      )}
                    </Box>
                  )}

                  {/* ASK AI TAB */}
                  {activeTab === 1 && (
                    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "350px" }}>
                      <Box sx={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: "8px", p: 1.5, mb: 2, backgroundColor: "#fafafa", overflowY: "auto", maxHeight: "300px" }}>
                        {chatHistory.length === 0 ? (
                          <Typography color="textSecondary" variant="body2" sx={{ textAlign: "center", mt: 5 }}>
                            Ask questions about this meeting, e.g., "What were the action items?" or "What deadlines were discussed?"
                          </Typography>
                        ) : (
                          chatHistory.map((msg, i) => (
                            <Box key={i} sx={{ mb: 2, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                              <Paper sx={{ p: 1.5, maxWidth: "80%", backgroundColor: msg.role === "user" ? "#018CCB" : "#fff", color: msg.role === "user" ? "#fff" : "#333", border: msg.role === "user" ? "none" : "1px solid #ddd" }}>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>{msg.text}</Typography>
                              </Paper>
                            </Box>
                          ))
                        )}
                        {answering && (
                          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2 }}>
                            <Paper sx={{ p: 1.5, border: "1px solid #ddd", display: "flex", alignItems: "center", gap: 1 }}>
                              <CircularProgress size={16} />
                              <Typography variant="body2" color="textSecondary">Answering...</Typography>
                            </Paper>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField
                          placeholder="Ask this meeting..."
                          size="small"
                          fullWidth
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleAskQuestion()}
                        />
                        <IconButton onClick={handleAskQuestion} color="primary" sx={{ backgroundColor: "#018CCB", color: "white", "&:hover": { backgroundColor: "#0179b0" } }}>
                          <SendIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  )}

                  {/* TASKS TAB */}
                  {activeTab === 2 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1.5 }}>Extracted Action Items & Tasks</Typography>
                      {tasks.length > 0 ? (
                        <List>
                          {tasks.map((task) => (
                            <ListItem
                              key={task._id}
                              secondaryAction={
                                <Box sx={{ display: "flex" }}>
                                  <IconButton edge="end" onClick={() => {
                                    setEditingTask(task);
                                    setEditTaskText(task.task);
                                    setEditOwner(task.assignedTo);
                                    setEditDeadline(task.deadline);
                                  }} sx={{ mr: 1 }}>
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton edge="end" onClick={() => handleDeleteTask(task._id)} color="error">
                                    <DeleteIcon />
                                  </IconButton>
                                </Box>
                              }
                              divider
                              disablePadding
                            >
                              <Checkbox checked={task.completed} onChange={() => handleToggleTask(task)} />
                              <ListItemText
                                primary={
                                  <Typography sx={{ textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "text.secondary" : "text.primary" }}>
                                    {task.task}
                                  </Typography>
                                }
                                secondary={`Assigned to: ${task.assignedTo} | Deadline: ${task.deadline}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography color="textSecondary" variant="body2">No tasks extracted yet.</Typography>
                      )}
                    </Box>
                  )}

                  {/* ANALYTICS TAB */}
                  {activeTab === 3 && (
                    <Box>
                      {analytics ? (
                        <Box>
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6}>
                              <Card variant="outlined">
                                <CardContent sx={{ textAlign: "center", p: 1.5 }}>
                                  <Typography color="textSecondary" variant="caption">Duration</Typography>
                                  <Typography variant="h5" sx={{ fontWeight: "bold" }}>{Math.round(analytics.duration / 60)} min</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={6}>
                              <Card variant="outlined">
                                <CardContent sx={{ textAlign: "center", p: 1.5 }}>
                                  <Typography color="textSecondary" variant="caption">Meeting Score</Typography>
                                  <Typography variant="h5" sx={{ fontWeight: "bold", color: "#4caf50" }}>{analytics.meetingScore}%</Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          </Grid>

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1.5 }}>Participant Speaking Times</Typography>
                          {analytics.participants?.map((p, i) => {
                            const percent = Math.min(100, Math.round((p.speakingTime / (analytics.duration || 1)) * 100));
                            return (
                              <Box key={i} sx={{ mb: 2.5 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>{p.username}</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {p.speakingTime}s ({p.speakingTurns} turns, {p.questionsAsked} questions)
                                  </Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 4 }} />
                              </Box>
                            );
                          })}

                          <Typography variant="subtitle1" sx={{ fontWeight: "bold", mt: 3, mb: 1 }}>Keywords Discussed</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {analytics.frequentlyDiscussed?.map((topic, i) => (
                              <Chip key={i} label={topic} color="primary" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Typography color="textSecondary" variant="body2">No analytics available.</Typography>
                      )}
                    </Box>
                  )}

                </Box>
              </>
            )}
          </Box>
        )}
      </Drawer>

      {/* Edit Task Dialog */}
      <Dialog open={editingTask !== null} onClose={() => setEditingTask(null)}>
        <DialogTitle>Edit Task Details</DialogTitle>
        <DialogContent sx={{ minWidth: "300px", pt: 1 }}>
          <TextField
            margin="dense"
            label="Task Description"
            fullWidth
            value={editTaskText}
            onChange={(e) => setEditTaskText(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Assigned To"
            fullWidth
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Deadline"
            fullWidth
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTask(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" sx={{ backgroundColor: "#018CCB" }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
