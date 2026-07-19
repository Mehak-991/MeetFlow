/**
 * SchedulerModal.jsx
 *
 * Migrated from: google_meet_scheduler/frontend/src/components/SchedulerModal.tsx
 * Framework change: Next.js → React (no router dependency)
 * API change: lib/api.ts → src/services/api.js  (createCalendarMeeting)
 * Language: TypeScript → JavaScript
 *
 * Props:
 *   isOpen   {boolean}    — whether the modal is visible
 *   onClose  {function}   — called when user dismisses
 *   onSuccess {function}  — called after meeting is successfully created
 */

import { useState, useEffect } from "react";
import { X, Mail, Globe, Plus, AlertCircle, Copy, Check } from "lucide-react";
import { createCalendarMeeting } from "../services/api";

const TIMEZONES = [
  { value: "UTC",                label: "Coordinated Universal Time (UTC)" },
  { value: "Asia/Kolkata",       label: "India Standard Time (IST) — Kolkata" },
  { value: "America/New_York",   label: "Eastern Time (EST) — New York" },
  { value: "America/Chicago",    label: "Central Time (CST) — Chicago" },
  { value: "America/Los_Angeles",label: "Pacific Time (PST) — Los Angeles" },
  { value: "Europe/London",      label: "Greenwich Mean Time (GMT) — London" },
  { value: "Europe/Paris",       label: "Central European Time (CET) — Paris" },
  { value: "Asia/Tokyo",         label: "Japan Standard Time (JST) — Tokyo" },
  { value: "Australia/Sydney",   label: "Australian Eastern Time (AEST) — Sydney" },
];

export default function SchedulerModal({ isOpen, onClose, onSuccess }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [date,        setDate]        = useState("");
  const [startTime,   setStartTime]   = useState("");
  const [endTime,     setEndTime]     = useState("");
  const [timezone,    setTimezone]    = useState("UTC");
  const [emailInput,  setEmailInput]  = useState("");
  const [attendees,   setAttendees]   = useState([]);

  const [loading,     setLoading]     = useState(false);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [successData, setSuccessData] = useState(null); // { meetLink, meetingCode }
  const [copied,      setCopied]      = useState(false);

  // Reset & set defaults when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Detect user timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {}

    // Default to today
    const today = new Date();
    const yyyy  = today.getFullYear();
    const mm    = String(today.getMonth() + 1).padStart(2, "0");
    const dd    = String(today.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);

    const hour     = today.getHours();
    setStartTime(`${String((hour + 1) % 24).padStart(2, "0")}:00`);
    setEndTime(`${String((hour + 2) % 24).padStart(2, "0")}:00`);

    setTitle("");
    setDescription("");
    setEmailInput("");
    setAttendees([]);
    setErrorMsg("");
    setSuccessData(null);
    setCopied(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleAddAttendee = (e) => {
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== ",") return;
    if (e.type === "keydown") e.preventDefault();

    const email = emailInput.trim().replace(/,/g, "");
    if (!email) return;
    if (!validateEmail(email)) { setErrorMsg("Please enter a valid email address."); return; }
    if (attendees.includes(email)) { setErrorMsg("Email already added."); return; }

    setAttendees((prev) => [...prev, email]);
    setEmailInput("");
    setErrorMsg("");
  };

  const handleRemoveAttendee = (idx) =>
    setAttendees((prev) => prev.filter((_, i) => i !== idx));

  const handleCopyLink = () => {
    if (!successData?.meetingLink) return;
    navigator.clipboard.writeText(successData.meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (!title.trim()) {
      setErrorMsg("Meeting title is required.");
      setLoading(false);
      return;
    }

    const startDT = new Date(`${date}T${startTime}`);
    const endDT   = new Date(`${date}T${endTime}`);

    if (isNaN(startDT.getTime()) || isNaN(endDT.getTime())) {
      setErrorMsg("Please enter valid start and end times.");
      setLoading(false);
      return;
    }
    if (endDT <= startDT) {
      setErrorMsg("End time must be after start time.");
      setLoading(false);
      return;
    }

    try {
      const result = await createCalendarMeeting({
        title,
        description: description.trim() || undefined,
        startTime:   startDT.toISOString(),
        endTime:     endDT.toISOString(),
        timezone,
        attendees,
      });

      setSuccessData({
        meetingLink:    result.meetingLink  || "",
        googleMeetLink: result.googleMeetLink || "",
        meetingCode:    result.meetingCode  || "",
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(err.message || "Failed to create the meeting. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80">
          <h2 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
            Schedule a Meeting
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Success screen ── */}
          {successData ? (
            <div className="space-y-6 py-4 text-center">
              <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center text-indigo-400 mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Meeting Scheduled!</h3>
                <p className="text-zinc-400 text-sm">
                  The Google Calendar event has been created and invitations sent to attendees.
                </p>
              </div>

              {/* Meeting link */}
              {(successData.googleMeetLink || successData.meetingLink) && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/60 flex items-center justify-between gap-3 text-left">
                  <div className="overflow-hidden">
                    <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                      {successData.googleMeetLink ? "Google Meet Link" : "Meeting Link"}
                    </div>
                    <a
                      href={successData.googleMeetLink || successData.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline font-mono text-sm truncate block mt-0.5"
                    >
                      {successData.googleMeetLink || successData.meetingLink}
                    </a>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                {(successData.googleMeetLink || successData.meetingLink) && (
                  <a
                    href={successData.googleMeetLink || successData.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all"
                  >
                    Join Meeting
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-sm transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Alignment Session"
                  required
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-white outline-none placeholder:text-zinc-600 transition-all text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add agenda, notes, or details…"
                  className="w-full px-4 py-3 min-h-[80px] bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-white outline-none placeholder:text-zinc-600 transition-all text-sm resize-y"
                />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none text-sm cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Time Slot</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none text-sm cursor-pointer text-center"
                    />
                    <span className="text-zinc-500 text-xs">to</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none text-sm cursor-pointer text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Timezone</label>
                <div className="relative">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl text-white outline-none text-sm cursor-pointer appearance-none"
                  >
                    {!TIMEZONES.some((tz) => tz.value === timezone) && (
                      <option value={timezone}>{timezone}</option>
                    )}
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-500">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Attendees */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Invite Guests
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={handleAddAttendee}
                      placeholder="Add guest email and press Enter"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-white outline-none placeholder:text-zinc-600 transition-all text-sm"
                    />
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-600" />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAttendee}
                    className="px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center border border-zinc-800"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {attendees.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-1 border border-dashed border-zinc-800 rounded-xl">
                    {attendees.map((email, idx) => (
                      <div
                        key={email}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-lg"
                      >
                        <span className="truncate max-w-[200px]">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttendee(idx)}
                          className="hover:text-indigo-200 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-indigo-500/10 cursor-pointer flex items-center gap-2 disabled:opacity-60"
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{loading ? "Scheduling…" : "Schedule"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
