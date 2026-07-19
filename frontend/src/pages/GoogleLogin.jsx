/**
 * GoogleLogin.jsx
 *
 * Migrated from: google_meet_scheduler/frontend/src/app/page.tsx
 * Framework change: Next.js → React Router (useNavigate instead of useRouter)
 * API change: lib/api.ts → src/services/api.js
 *
 * Route: /google-login
 *
 * This page lets users connect their Google Calendar account to MeetFlow.
 * After connecting, they are redirected to /schedule (the calendar dashboard).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGoogleOAuthUrl, isGoogleConnected } from "../services/api";
import { Calendar, Video, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function GoogleLogin() {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(false);
  const [checkingAuth, setChecking] = useState(true);
  const [errorMsg, setErrorMsg]     = useState("");

  // If already connected, skip to /schedule
  useEffect(() => {
    if (isGoogleConnected()) {
      navigate("/schedule", { replace: true });
    } else {
      setChecking(false);
    }
  }, [navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await getGoogleOAuthUrl();
      if (response && response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("Could not retrieve the Google login URL.");
      }
    } catch (err) {
      console.error("[GoogleLogin]", err);
      setErrorMsg(err.message || "Failed to connect to the authentication server.");
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex flex-col items-center justify-center bg-zinc-950 min-h-screen text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden font-sans">
      {/* Background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-zinc-900 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            MeetFlow
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Scheduler
          </span>
        </div>
        {/* Back to main dashboard */}
        <button
          onClick={() => navigate("/home")}
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Back to Dashboard
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto px-6 py-12 relative z-10 text-center">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Seamless Google Calendar Integration
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none">
            Schedule Meetings{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              In A Single Click
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-xl mx-auto font-light leading-relaxed">
            Connect your Google Calendar, schedule events, auto-generate Google
            Meet links, and invite guests in seconds.
          </p>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm max-w-md mx-auto">
              {errorMsg}
            </div>
          )}

          <div className="pt-4 flex flex-col items-center justify-center">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-semibold rounded-2xl shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center gap-3 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                <>
                  {/* Google G logo */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>Connect with Google Calendar</span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          {[
            {
              icon: <Calendar className="w-5 h-5" />,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10 border-indigo-500/20",
              title: "Calendar Sync",
              desc: "Every meeting is synced directly into your Google Calendar as a native event.",
            },
            {
              icon: <Video className="w-5 h-5" />,
              color: "text-purple-400",
              bg: "bg-purple-500/10 border-purple-500/20",
              title: "Google Meet Generation",
              desc: "Meet links are generated instantly and attached automatically to every event.",
            },
            {
              icon: <Mail className="w-5 h-5" />,
              color: "text-pink-400",
              bg: "bg-pink-500/10 border-pink-500/20",
              title: "Auto Invitations",
              desc: "Google handles elegant email invites and RSVP management for your guests.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 transition-all flex flex-col gap-3"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${f.bg} ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        <div>© {new Date().getFullYear()} MeetFlow. All rights reserved.</div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>OAuth 2.0 Secure Authentication</span>
        </div>
      </footer>
    </div>
  );
}
