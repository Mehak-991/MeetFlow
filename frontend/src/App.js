/**
 * App.js — Single React Router for the entire MeetFlow frontend.
 *
 * All routes live here. There is ONE BrowserRouter.
 *
 * Existing MeetFlow routes (unchanged):
 *   /                    → LandingPage
 *   /auth                → Authentication
 *   /home                → HomeComponent  (protected)
 *   /history             → History        (protected)
 *   /insights            → InsightsDashboard (protected)
 *   /meeting/:meetingCode → VideoMeetComponent
 *   /:url                → VideoMeetComponent (legacy fallback)
 *
 * Migrated Scheduler routes (new):
 *   /google-login        → GoogleLogin   (connect Google Calendar)
 *   /google-callback     → GoogleCallback (OAuth redirect handler)
 *   /schedule            → Schedule      (calendar meeting dashboard)
 */

import "./App.css";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

// ── Existing pages ────────────────────────────────────────────────────────────
import LandingPage        from "./pages/landing";
import Authentication     from "./pages/authentication";
import { AuthProvider }   from "./contexts/AuthContext";
import { ThemeProvider }  from "./contexts/ThemeContext";
import VideoMeetComponent from "./pages/VideoMeet";
import HomeComponent      from "./pages/home";
import History            from "./pages/history";
import InsightsDashboard  from "./pages/insights";

// ── Migrated scheduler pages ──────────────────────────────────────────────────
import GoogleLogin        from "./pages/GoogleLogin";
import GoogleCallback     from "./pages/GoogleCallback";
import Schedule           from "./pages/Schedule";

function App() {
  return (
    <div className="App">
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              {/* ── Existing MeetFlow routes ── */}
              <Route path="/"        element={<LandingPage />} />
              <Route path="/auth"    element={<Authentication />} />
              <Route path="/home"    element={<HomeComponent />} />
              <Route path="/history" element={<History />} />
              <Route path="/insights" element={<InsightsDashboard />} />

              {/* ── Migrated Google Calendar / Scheduler routes ── */}
              <Route path="/google-login"    element={<GoogleLogin />} />
              <Route path="/google-callback" element={<GoogleCallback />} />
              <Route path="/schedule"        element={<Schedule />} />

              {/* ── Video meeting routes ── */}
              {/* Primary: /meeting/:meetingCode  */}
              <Route path="/meeting/:meetingCode" element={<VideoMeetComponent />} />
              {/* Legacy fallback: /:url — handles old invite links and direct code entry */}
              <Route path="/:url" element={<VideoMeetComponent />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </div>
  );
}

export default App;
