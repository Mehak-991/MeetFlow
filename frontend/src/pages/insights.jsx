import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  IconButton,
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
  LinearProgress
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PieChartIcon from "@mui/icons-material/PieChart";
import ScheduleIcon from "@mui/icons-material/Schedule";
import withAuth from "../utils/withAuth";
import server from "../environment";

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

function InsightsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  
  // Tasks list state
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchInsights = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await client.get("/dashboard-insights", { params: { token } });
      setInsights(res.data);

      // Fetch all user meetings, then fetch tasks for each
      const meetingsRes = await client.get("/get_all_activity", { params: { token } });
      const meetings = meetingsRes.data;
      
      let allTasks = [];
      for (const meet of meetings) {
        try {
          const tRes = await client.get("/meeting-tasks", { params: { meetingCode: meet.meetingCode } });
          allTasks = [...allTasks, ...tRes.data];
        } catch (err) {
          console.error("Error fetching tasks for", meet.meetingCode, err);
        }
      }
      setTasks(allTasks);
    } catch (error) {
      console.error("Failed to fetch dashboard insights:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const token = localStorage.getItem("token");
      const res = await client.get("/smart-search", { params: { token, query: searchQuery } });
      setSearchResults(res.data);
    } catch (error) {
      console.error("Smart search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const updated = { ...task, completed: !task.completed };
      const res = await client.put(`/meeting-tasks/${task._id}`, updated);
      setTasks(tasks.map((t) => (t._id === task._id ? res.data : t)));
      
      // Refresh insights summary counters
      const token = localStorage.getItem("token");
      const insightRes = await client.get("/dashboard-insights", { params: { token } });
      setInsights(insightRes.data);
    } catch (error) {
      console.error("Failed to toggle task status:", error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await client.delete(`/meeting-tasks/${taskId}`);
      setTasks(tasks.filter((t) => t._id !== taskId));
      
      // Refresh insights summary counters
      const token = localStorage.getItem("token");
      const insightRes = await client.get("/dashboard-insights", { params: { token } });
      setInsights(insightRes.data);
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: "#f4f6f8", minHeight: "100vh", padding: "30px" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => navigate("/home")} sx={{ backgroundColor: "#018CCB", color: "white", "&:hover": { backgroundColor: "#0179b0" } }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: "bold", color: "#333", ml: 1 }}>
            AI Insights Dashboard
          </Typography>
        </Box>
        <Chip label="Platform Active" color="success" variant="outlined" />
      </Box>

      {/* Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: "4px solid #4caf50", borderRadius: "8px" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="textSecondary" variant="overline">Average Meeting Score</Typography>
                <TrendingUpIcon sx={{ color: "#4caf50" }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>
                {insights?.averageMeetingScore || 0}%
              </Typography>
              <LinearProgress variant="determinate" value={insights?.averageMeetingScore || 0} color="success" sx={{ mt: 2, height: 6, borderRadius: 3 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: "4px solid #2196f3", borderRadius: "8px" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="textSecondary" variant="overline">Participation Score</Typography>
                <PieChartIcon sx={{ color: "#2196f3" }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>
                {insights?.averageParticipationScore || 0}%
              </Typography>
              <LinearProgress variant="determinate" value={insights?.averageParticipationScore || 0} color="primary" sx={{ mt: 2, height: 6, borderRadius: 3 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: "4px solid #ff9800", borderRadius: "8px" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="textSecondary" variant="overline">Deadlines Pending</Typography>
                <ScheduleIcon sx={{ color: "#ff9800" }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>
                {insights?.deadlinesPending || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                Out of {insights?.tasksCreated || 0} total tasks
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: "4px solid #9c27b0", borderRadius: "8px" }}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="textSecondary" variant="overline">Tasks Completed</Typography>
                <AssignmentTurnedInIcon sx={{ color: "#9c27b0" }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: "bold", mt: 1 }}>
                {insights?.completedTasks || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                Completion Rate: {insights?.tasksCreated > 0 ? Math.round((insights.completedTasks / insights.tasksCreated) * 100) : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Smart Search */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: "10px" }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>Smart Search Across Meetings</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Search transcripts (e.g. 'authentication', 'React', 'MongoDB', 'deadline')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            size="small"
          />
          <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />} sx={{ backgroundColor: "#018CCB" }}>
            Search
          </Button>
        </Box>

        {searching && <LinearProgress sx={{ mt: 2 }} />}

        {searchResults.length > 0 && (
          <List sx={{ mt: 2, maxHeight: "300px", overflowY: "auto", border: "1px solid #e0e0e0", borderRadius: "8px", p: 0 }}>
            {searchResults.map((res, i) => (
              <ListItem key={i} divider sx={{ backgroundColor: "#fff" }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="subtitle2" color="primary" sx={{ fontWeight: "bold" }}>
                        Meeting: {res.meetingCode}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Speaker: {res.speaker} | {new Date(res.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  }
                  secondary={res.text}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Grid: Topics & Tasks */}
      <Grid container spacing={3}>
        {/* Topics */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: "100%", borderRadius: "10px" }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>Frequently Discussed Topics</Typography>
            {insights?.frequentlyDiscussedTopics?.length > 0 ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {insights.frequentlyDiscussedTopics.map((topic, i) => (
                  <Chip
                    key={i}
                    label={`${topic.name} (${topic.count})`}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: "500" }}
                  />
                ))}
              </Box>
            ) : (
              <Typography color="textSecondary" variant="body2">No topics processed yet.</Typography>
            )}

            <Typography variant="h6" sx={{ fontWeight: "bold", mt: 4, mb: 2 }}>Sentiment Overview</Typography>
            {insights?.sentimentTrend?.length > 0 ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {insights.sentimentTrend.map((s, i) => (
                  <Chip
                    key={i}
                    label={`${s.name} (${s.value}x)`}
                    sx={{ backgroundColor: "#e8f5e9", color: "#2e7d32", fontWeight: "bold" }}
                  />
                ))}
              </Box>
            ) : (
              <Typography color="textSecondary" variant="body2">Sentiment metrics pending.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Tasks list */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: "10px" }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>All Extracted Tasks & Deadlines</Typography>
            {tasks.length > 0 ? (
              <List sx={{ width: "100%" }}>
                {tasks.map((task) => (
                  <ListItem
                    key={task._id}
                    secondaryAction={
                      <Box>
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
                    disablePadding
                    divider
                  >
                    <Checkbox
                      checked={task.completed}
                      onChange={() => handleToggleTask(task)}
                    />
                    <ListItemText
                      primary={
                        <Typography sx={{ textDecoration: task.completed ? "line-through" : "none", color: task.completed ? "text.secondary" : "text.primary", fontWeight: "500" }}>
                          {task.task}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: "flex", gap: 1.5, mt: 0.5 }}>
                          <Chip size="small" label={`Owner: ${task.assignedTo}`} variant="outlined" />
                          <Chip size="small" label={`Deadline: ${task.deadline}`} color="warning" variant="outlined" />
                          <Chip size="small" label={`Meeting: ${task.meetingCode}`} color="primary" variant="outlined" />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="textSecondary" variant="body2">No tasks extracted yet. Tasks are auto-generated when meetings conclude.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

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

export default withAuth(InsightsDashboard);
