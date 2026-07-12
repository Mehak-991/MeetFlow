import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { Button, IconButton, TextField } from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import { MdLightMode, MdDarkMode } from "react-icons/md";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");

  const { addToUserHistory } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useTheme();

  const handleJoinVideoCall = async () => {
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <>
      {/* Navbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 30px",
          backgroundColor: darkMode ? "#1a1a1a" : "white",
          boxShadow: darkMode ? "0px 2px 6px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/erasebg-transformed (1).png"
            alt="Logo"
            style={{ height: "48px", cursor: "pointer" }}
            onClick={() => navigate("/")}
          />
        </div>

        {/* Icons Section */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: darkMode ? "#e0e0e0" : "#333",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#018CCB")}
            onMouseLeave={(e) => (e.currentTarget.style.color = darkMode ? "#e0e0e0" : "#333")}
          >
            {darkMode ? <MdLightMode size={24} /> : <MdDarkMode size={24} />}
          </div>
          <div
            onClick={() => navigate("/history")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: darkMode ? "#e0e0e0" : "#333",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#018CCB")}
            onMouseLeave={(e) => (e.currentTarget.style.color = darkMode ? "#e0e0e0" : "#333")}
          >
            <RestoreIcon />
            <span style={{ fontSize: "16px", fontWeight: "500" }}>History</span>
          </div>
          <div
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              color: darkMode ? "#e0e0e0" : "#333",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#018CCB")}
            onMouseLeave={(e) => (e.currentTarget.style.color = darkMode ? "#e0e0e0" : "#333")}
          >
            <LogoutIcon />
            <span style={{ fontSize: "16px", fontWeight: "500" }}>Logout</span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "90vh",
          padding: "0 20px",
          backgroundColor: darkMode ? "#0a0a0a" : "white",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
            width: "100%",
          }}
        >
          <h2
            style={{
              color: "#018CCB",
              fontWeight: "600",
              marginBottom: "25px",
              fontSize: "28px",
            }}
          >
            Providing Quality Video Call
          </h2>

          <div
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <TextField
              onChange={(e) => setMeetingCode(e.target.value)}
              id="outlined-basic"
              label="Meeting Code"
              variant="outlined"
              fullWidth
              sx={{
                input: { color: darkMode ? "#e0e0e0" : "inherit" },
                label: { color: darkMode ? "#b0b0b0" : "inherit" },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: darkMode ? "#444" : "inherit" },
                  "&:hover fieldset": { borderColor: darkMode ? "#666" : "inherit" },
                },
              }}
            />
            <Button
              onClick={handleJoinVideoCall}
              variant="contained"
              sx={{
                backgroundColor: "#018CCB",
                ":hover": { backgroundColor: "#0179b0" },
              }}
            >
              Join
            </Button>
          </div>
        </div>
        <div style={{ marginLeft: "50px" }}>
          <img
            src="/logo3-Photoroom.png"
            alt="Illustration"
            style={{ maxWidth: "400px", width: "100%", height: "auto", opacity: darkMode ? 0.9 : 1 }}
          />
        </div>
      </div>
    </>
  );
}

export default withAuth(HomeComponent);
