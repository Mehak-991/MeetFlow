/**
 * Schedule.jsx
 *
 * Migrated from: google_meet_scheduler/frontend/src/app/my-meetings/page.tsx
 * Framework: Next.js → React Router (useNavigate instead of useRouter)
 * API: lib/api.ts → src/services/api.js
 * Language: TypeScript → JavaScript
 *
 * Route: /schedule
 * Protected: requires Google Calendar connection (/google-login)
 *
 * Shows all Google Calendar meetings for the current user.
 * Lets them schedule new ones via SchedulerModal.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listCalendarMeetings,
  cancelCalendarMeeting,
  rescheduleCalendarMeeting,
  isGoogleConnected,
  getGoogleUser,
  removeGoogleToken,
} from "../services/api";
import SchedulerModal from "../components/SchedulerModal";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  LogOut,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  Mail,
  User as UserIcon,
  CalendarDays,
} from "lucide-react";

export default function Schedule() {
  const navigate = useNavigate();

  const [meetings,      setMeetings]      = useState([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [userInfo,      setUserInfo]      = useState(null);

  // Reschedule inline state
  const [reschedulingCode, setReschedulingCode] = useState(null);
  const [newDate,          setNewDate]          = useState("");
  const [newStart,         setNewStart]         = useState("");
  const [newEnd,           setNewEnd]           = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Copy link
  const [copiedCode, setCopiedCode] = useState(null);

  // ── Fetch meetings ──────────────────────────────────────────────────────────
  const fetchMeetings = useCallback(
    async (currPage = page, sQuery = search, sFilter = statusFilter) => {
      setLoading(true);
      try {
        const params = { page: String(currPage), limit: "6" };
        if (sQuery)  params.search = sQuery;
        if (sFilter) params.status = sFilter;

        const data = await listCalendarMeetings(params);
        setMeetings(data.meetings || []);
        setTotal(data.total   || 0);
        setPages(data.pages   || 1);
        setPage(data.page     || currPage);
      } catch (err) {
        console.error("[Schedule] fetchMeetings:", err.message);
      } finally {
        setLoading(false);
      }
    },
    [page, search, statusFilter]
  );

  useEffect(() => {
    if (!isGoogleConnected()) {
      navigate("/google-login", { replace: true });
      return;
    }
    setUserInfo(getGoogleUser());
    fetchMeetings(1, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    removeGoogleToken();
    navigate("/google-login");
  };

  // ── Copy meet link ───────────────────────────────────────────────────────────
  const handleCopyLink = (link, code) => {
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ── Cancel meeting ───────────────────────────────────────────────────────────
  const handleCancel = async (meetingCode) => {
    if (!window.confirm("Cancel this meeting? This will also remove it from Google Calendar.")) return;
    try {
      await cancelCalendarMeeting(meetingCode);
      fetchMeetings();
    } catch (err) {
      alert(err.message || "Failed to cancel meeting.");
    }
  };

  // ── Start reschedule ─────────────────────────────────────────────────────────
  const startRescheduling = (meeting) => {
    const s = new Date(meeting.startTime || meeting.start_time);
    const e = new Date(meeting.endTime   || meeting.end_time);
    const yyyy = s.getFullYear();
    const mm   = String(s.getMonth() + 1).padStart(2, "0");
    const dd   = String(s.getDate()).padStart(2, "0");
    setNewDate(`${yyyy}-${mm}-${dd}`);
    setNewStart(s.toTimeString().substring(0, 5));
    setNewEnd(e.toTimeString().substring(0, 5));
    setReschedulingCode(meeting.meetingCode);
  };

  const handleRescheduleSubmit = async (meeting) => {
    setRescheduleLoading(true);
    try {
      const startDT = new Date(`${newDate}T${newStart}`);
      const endDT   = new Date(`${newDate}T${newEnd}`);
      if (endDT <= startDT) { alert("End time must be after start time."); return; }

      await rescheduleCalendarMeeting(meeting.meetingCode, {
        startTime: startDT.toISOString(),
        endTime:   endDT.toISOString(),
        timezone:  meeting.timezone || "UTC",
      });
      setReschedulingCode(null);
      fetchMeetings();
    } catch (err) {
      alert(err.message || "Failed to reschedule.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  // ── Search / filter helpers ──────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    fetchMeetings(1, e.target.value, statusFilter);
  };

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    fetchMeetings(1, search, filter);
  };

  // ── Date / time formatters ───────────────────────────────────────────────────
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  const formatRange = (startIso, endIso) => {
    const s = new Date(startIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const e = new Date(endIso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${s} – ${e}`;
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white font-sans">

      {/* Navbar */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center cursor-pointer"
              onClick={() => navigate("/home")}
            >
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
              MeetFlow
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Scheduler
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Back to main dashboard */}
            <button
              onClick={() => navigate("/home")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              ← Dashboard
            </button>

            {userInfo && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300">
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span className="max-w-[160px] truncate">{userInfo.name || userInfo.email}</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors border border-zinc-900 cursor-pointer"
              title="Disconnect Google Calendar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Title + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Calendar Meetings</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Manage and schedule your Google Meet video conferences.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="self-start px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule Meeting
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by title…"
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-white outline-none placeholder:text-zinc-600 text-sm"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-600" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "All",       value: "" },
              { label: "Active",    value: "ACTIVE" },
              { label: "Ended",     value: "ENDED" },
              { label: "Expired",   value: "EXPIRED" },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleFilterChange(btn.value)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  statusFilter === btn.value
                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                    : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-800"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-3xl bg-zinc-900/20 border border-zinc-900 p-6 space-y-4 animate-pulse">
                <div className="h-4 bg-zinc-850 rounded w-1/3" />
                <div className="h-6 bg-zinc-850 rounded w-3/4" />
                <div className="h-4 bg-zinc-850 rounded w-2/3" />
                <div className="h-10 bg-zinc-850 rounded w-full mt-4" />
              </div>
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-zinc-900/10 border border-dashed border-zinc-900 max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">No calendar meetings yet</h3>
              <p className="text-zinc-500 text-sm mt-1">
                Click <strong>Schedule Meeting</strong> to create your first Google Calendar event.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => {
              const code      = meeting.meetingCode;
              const status    = meeting.meetingStatus || "ACTIVE";
              const meetLink  = meeting.googleMeetLink || meeting.meetingLink || "";
              const startIso  = meeting.startTime || meeting.start_time;
              const endIso    = meeting.endTime   || meeting.end_time;

              return (
                <div
                  key={code}
                  className={`relative rounded-3xl bg-zinc-900/30 border p-6 flex flex-col justify-between min-h-[260px] hover:border-zinc-700 transition-all ${
                    status === "ENDED" ? "border-rose-500/10 opacity-75" : "border-zinc-900"
                  }`}
                >
                  {/* Status badge */}
                  <div className="absolute top-6 right-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      status === "ACTIVE"
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : status === "ENDED"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}>
                      {status.toLowerCase()}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    {meeting.timezone && (
                      <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        {meeting.timezone}
                      </div>
                    )}

                    <h3 className="text-lg font-bold pr-20 truncate text-white" title={meeting.meetingTitle}>
                      {meeting.meetingTitle || "MeetFlow Meeting"}
                    </h3>

                    {meeting.description && (
                      <p className="text-sm text-zinc-400 line-clamp-2">{meeting.description}</p>
                    )}

                    <div className="space-y-1.5 pt-1.5 border-t border-zinc-900">
                      {startIso && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <CalendarIcon className="w-4 h-4 text-zinc-500" />
                          <span>{formatDate(startIso)}</span>
                        </div>
                      )}
                      {startIso && endIso && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          <span>{formatRange(startIso, endIso)}</span>
                        </div>
                      )}
                    </div>

                    {meeting.attendees?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-400 font-semibold">
                          {meeting.attendees.length} guest{meeting.attendees.length !== 1 ? "s" : ""} invited
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-6 mt-4 border-t border-zinc-900/60">
                    {reschedulingCode === code ? (
                      <div className="space-y-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
                        <div className="text-xs font-semibold text-zinc-400">Reschedule</div>
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                        />
                        <div className="flex gap-2">
                          <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                            className="w-1/2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white text-center" />
                          <input type="time" value={newEnd}   onChange={(e) => setNewEnd(e.target.value)}
                            className="w-1/2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white text-center" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setReschedulingCode(null)} disabled={rescheduleLoading}
                            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md text-white">
                            Cancel
                          </button>
                          <button onClick={() => handleRescheduleSubmit(meeting)} disabled={rescheduleLoading}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs rounded-md font-semibold text-white">
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {meetLink && status === "ACTIVE" && (
                            <>
                              <a
                                href={meetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
                              >
                                Join <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                onClick={() => handleCopyLink(meetLink, code)}
                                className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                title="Copy link"
                              >
                                {copiedCode === code
                                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                        </div>

                        {status === "ACTIVE" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => startRescheduling(meeting)}
                              className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Reschedule"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancel(code)}
                              className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Cancel meeting"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={() => { if (page > 1) fetchMeetings(page - 1); }}
              disabled={page === 1}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 disabled:opacity-50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-zinc-400 font-medium">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => { if (page < pages) fetchMeetings(page + 1); }}
              disabled={page === pages}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 disabled:opacity-50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Scheduler modal */}
      <SchedulerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchMeetings(1);
        }}
      />
    </div>
  );
}
