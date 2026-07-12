import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Button,
  Stack,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import HistoryIcon from "@mui/icons-material/History";

export default function History() {
  const { getHistoryOfUser } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const routeTo = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history);
      } catch {
        console.error("Failed to fetch history");
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <Box
      sx={{
        backgroundColor: "white",
        minHeight: "100vh",
        padding: "30px",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <HistoryIcon sx={{ color: "#1E88E5", fontSize: 30 }} />
          <Typography
            variant="h5"
            sx={{ color: "#1E88E5", fontWeight: "600", letterSpacing: "0.5px" }}
          >
            Meeting History
          </Typography>
        </Box>

        <IconButton
          onClick={() => routeTo("/home")}
          sx={{
            backgroundColor: "#1E88E5",
            color: "white",
            "&:hover": { backgroundColor: "#1565C0" },
          }}
        >
          <HomeIcon />
        </IconButton>
      </Box>

      {/* Meeting Cards - Vertical Listing */}
      {meetings.length > 0 ? (
        <Stack
          spacing={2}
          sx={{
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          {meetings.map((meeting, index) => (
            <Card
              key={index}
              variant="outlined"
              sx={{
                borderRadius: "10px",
                transition: "0.3s",
                padding: "10px",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: "0px 3px 12px rgba(0,0,0,0.15)",
                },
              }}
            >
              <CardContent>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Meeting Code
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ color: "#1E88E5", fontWeight: "bold" }}
                >
                  {meeting.meetingCode}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ mt: 1.5, color: "text.secondary" }}
                >
                  Date: {formatDate(meeting.date)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            textAlign: "center",
            mt: 10,
            color: "gray",
          }}
        >
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
              backgroundColor: "#1E88E5",
              ":hover": { backgroundColor: "#1565C0" },
            }}
            onClick={() => routeTo("/home")}
          >
            Go to Home
          </Button>
        </Box>
      )}
    </Box>
  );
}
