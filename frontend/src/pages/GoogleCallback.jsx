/**
 * GoogleCallback.jsx
 *
 * Migrated from: google_meet_scheduler/frontend/src/app/auth/callback/page.tsx
 * Framework change: Next.js (useSearchParams) → React Router (useSearchParams from react-router-dom)
 * API change: lib/api.ts → src/services/api.js
 *
 * Route: /google-callback
 *
 * Google redirects to this URL after the user grants/denies permission.
 * The URL contains either:
 *   ?code=...        — an auth code to exchange for tokens
 *   ?error=...       — the user denied permission
 *
 * On success: stores the google_token, then redirects to /schedule.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { exchangeGoogleCode, setGoogleToken, setGoogleUser } from "../services/api";

export default function GoogleCallback() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus]     = useState("loading"); // "loading" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    const errorParam = searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setErrorMsg(decodeURIComponent(errorParam));
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      setErrorMsg("No authorization code found in the redirect URL.");
      return;
    }

    const doExchange = async () => {
      try {
        const data = await exchangeGoogleCode(code);

        if (!mounted) return;

        // Store Google token and user info
        setGoogleToken(data.token);
        setGoogleUser({
          email:             data.email,
          name:              data.name,
          googleConnected:   data.googleConnected,
          userId:            data.userId,
          username:          data.username,
        });

        // Also update the main MeetFlow token if returned
        if (data.token) {
          localStorage.setItem("token",    data.token);
          localStorage.setItem("userId",   data.userId   || "");
          localStorage.setItem("username", data.username || "");
          localStorage.setItem("name",     data.name     || "");
        }

        setStatus("success");
        setTimeout(() => {
          if (mounted) navigate("/schedule", { replace: true });
        }, 1500);
      } catch (err) {
        if (!mounted) return;
        console.error("[GoogleCallback]", err);
        setStatus("error");
        setErrorMsg(err.message || "Authentication failed. Please try again.");
      }
    };

    doExchange();
    return () => { mounted = false; };
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-950 min-h-screen text-white">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative glows */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-20 pointer-events-none" />

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-bold tracking-tight mt-2">Authenticating</h2>
            <p className="text-sm text-zinc-400">
              Connecting your Google Calendar and securing your session…
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center text-emerald-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-400 mt-2">Connected!</h2>
            <p className="text-sm text-zinc-400">
              Google Calendar connected successfully. Redirecting to your meeting dashboard…
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-rose-500/10 border-2 border-rose-500 rounded-full flex items-center justify-center text-rose-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-rose-400 mt-2">Authentication Failed</h2>
            <p className="text-sm text-zinc-400 mb-2">{errorMsg}</p>
            <button
              onClick={() => navigate("/google-login")}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-sm transition-all"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
