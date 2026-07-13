import * as React from "react";
import {
  Button,
  CssBaseline,
  TextField,
  Paper,
  Box,
  Typography,
  Snackbar,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLocation } from "react-router-dom";

const getTheme = (darkMode) => createTheme({
  palette: {
    mode: darkMode ? 'dark' : 'light',
    primary: { main: "#018CCB" },
    background: {
      default: darkMode ? '#0a0a0a' : '#ffffff',
      paper: darkMode ? '#1a1a1a' : '#ffffff',
    },
  },
  typography: { fontFamily: "Inter, Roboto, sans-serif" },
});

export default function Authentication() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialFormState = searchParams.get('mode') === 'signup' ? 1 : 0;

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [formState, setFormState] = React.useState(initialFormState); // 0 = Sign In, 1 = Sign Up
  const [open, setOpen] = React.useState(false);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);
  const { darkMode } = useTheme();
  const theme = React.useMemo(() => getTheme(darkMode), [darkMode]);

  const handleAuth = async () => {
    try {
      if (formState === 0) {
        await handleLogin(username, password);
      } else {
        const result = await handleRegister(name, username, password);
        setUsername("");
        setPassword("");
        setName("");
        setMessage(result);
        setOpen(true);
        setError("");
        setFormState(0);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Top Navbar with Logo */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          px: "40px",
          py: "6px",
          backgroundColor: darkMode ? "rgba(10,10,10,0.9)" : "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 2px 15px rgba(0,0,0,0.1)",
        }}
      >
        <img
          src="/erasebg-transformed (1).png"
          alt="MeetFlow Logo"
          style={{ height: "90px", width: "auto", cursor: "pointer" }}
          onClick={() => window.location.href = "/"}
        />
      </Box>

      {/* Container: responsive flex (column on xs, row on md+) */}
      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          overflow: "hidden",
          backgroundColor: darkMode ? '#0a0a0a' : '#f5f5f5',
          pt: "102px",
        }}
      >
        {/* Left panel */}
        <Box
          sx={{
            flex: { xs: "none", md: 1 },
            width: { xs: "100%", md: "50%" },
            height: { xs: "auto", md: "100vh" },
            backgroundColor: formState === 0 ? "#018CCB !important" : "#ffffff !important",
            color: formState === 0 ? "#ffffff" : "#018CCB",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            p: { xs: 6, md: 8 },
            boxSizing: "border-box",
            transition: "background-color 0.25s ease",
          }}
        >
          {formState === 0 ? (
            <>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Create Your Account
              </Typography>
              <Typography sx={{ mb: 4, maxWidth: 360 }}>
                Sign up in seconds and start connecting from anywhere.
              </Typography>

              <Button
                variant="outlined"
                onClick={() => setFormState(1)}
                sx={{
                  borderColor: "white",
                  color: "white",
                  px: 6,
                  py: 1.2,
                  borderRadius: "50px",
                  fontWeight: 600,
                }}
              >
                SIGN UP
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                Good to See You Again
              </Typography>
              <Typography sx={{ mb: 4, maxWidth: 360 }}>
                Access your meetings and stay connected with your team.
              </Typography>

              <Button
                variant="outlined"
                onClick={() => setFormState(0)}
                sx={{
                  borderColor: "#018CCB",
                  color: "#018CCB",
                  backgroundColor: "white",
                  px: 6,
                  py: 1.2,
                  borderRadius: "50px",
                  fontWeight: 600,
                }}
              >
                SIGN IN
              </Button>
            </>
          )}
        </Box>

        {/* Right panel (form) */}
        <Box
          component={Paper}
          elevation={0}
          sx={{
            flex: { xs: "none", md: 1 },
            width: { xs: "100%", md: "50%" },
            height: { xs: "auto", md: "100vh" },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 4, md: 8 },
            boxSizing: "border-box",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 560 }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, mb: { xs: 3, md: 4 }, textAlign: "center" }}
            >
              {formState === 0 ? "Sign In to MeetFlow" : "Create Account"}
            </Typography>

            {/* FORM FIELDS */}
            <Box component="form" noValidate autoComplete="off">
              {formState === 1 && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  InputProps={{
                    startAdornment: <PersonOutlinedIcon sx={{ mr: 1 }} />,
                  }}
                />
              )}

              <TextField
                fullWidth
                margin="normal"
                label="Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                InputProps={{
                  startAdornment: <EmailOutlinedIcon sx={{ mr: 1 }} />,
                }}
              />

              <TextField
                fullWidth
                margin="normal"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: <LockOpenOutlinedIcon sx={{ mr: 1 }} />,
                }}
              />

              {error && (
                <Typography sx={{ color: "red", mt: 1 }}>{error}</Typography>
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleAuth}
                sx={{
                  mt: 3,
                  py: 1.6,
                  borderRadius: "50px",
                  backgroundColor: "#018CCB",
                  "&:hover": { backgroundColor: "#0179b0" },
                  fontWeight: 700,
                }}
              >
                {formState === 0 ? "SIGN IN" : "SIGN UP"}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Visitor Login box */}
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            backgroundColor: "#ffffff",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            p: 2,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            zIndex: 2000,
            minWidth: 200,
          }}
        >
          <Typography sx={{ fontWeight: 700, mb: 1, fontSize: 15, color: "#333" }}>
            Visitor Login
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "#666", mb: 0.3 }}>
            Username: user09
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "#666" }}>
            Password: 12345678
          </Typography>
        </Box>

        <Snackbar
          open={open}
          autoHideDuration={4000}
          message={message}
          onClose={() => setOpen(false)}
        />
      </Box>
    </ThemeProvider>
  );
}
