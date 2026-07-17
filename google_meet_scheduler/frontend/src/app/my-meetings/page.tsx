'use strict';
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  apiRequest, 
  getAuthToken, 
  getUserInfo, 
  removeAuthToken 
} from '@/lib/api';
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
  CalendarDays
} from 'lucide-react';
import SchedulerModal from '@/components/SchedulerModal';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone: string;
  meet_link?: string;
  calendar_event_id?: string;
  organizer_email: string;
  attendees: string[];
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  rsvp_stats?: {
    accepted: number;
    declined: number;
    tentative: number;
    pending: number;
  };
}

export default function MyMeetings() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInfo, setUserInfoState] = useState<any>(null);

  // Reschedule form state
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMeetings = useCallback(async (currPage = page, sQuery = search, sFilter = statusFilter) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(currPage),
        limit: '6',
      });
      if (sQuery) queryParams.set('search', sQuery);
      if (sFilter) queryParams.set('status_filter', sFilter);

      const data = await apiRequest(`/api/meetings?${queryParams.toString()}`);
      setMeetings(data.meetings);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/');
      return;
    }
    setUserInfoState(getUserInfo());
    fetchMeetings(1, '', '');
  }, [router, fetchMeetings]);

  const handleLogout = () => {
    removeAuthToken();
    router.push('/');
  };

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancelMeeting = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this meeting? This will also remove/cancel the event on Google Calendar.')) {
      return;
    }

    try {
      await apiRequest(`/api/meetings/${id}`, {
        method: 'DELETE',
      });
      fetchMeetings();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel meeting');
    }
  };

  const startRescheduling = (meeting: Meeting) => {
    const startDateObj = new Date(meeting.start_time);
    const endDateObj = new Date(meeting.end_time);

    // Format for local datetime inputs
    const yyyy = startDateObj.getFullYear();
    const mm = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(startDateObj.getDate()).padStart(2, '0');
    
    setNewDate(`${yyyy}-${mm}-${dd}`);
    setNewStart(startDateObj.toTimeString().substring(0, 5));
    setNewEnd(endDateObj.toTimeString().substring(0, 5));
    setReschedulingId(meeting.id);
  };

  const handleRescheduleSubmit = async (meeting: Meeting) => {
    setRescheduleLoading(true);
    try {
      const startDateTime = new Date(`${newDate}T${newStart}`);
      const endDateTime = new Date(`${newDate}T${newEnd}`);

      if (endDateTime <= startDateTime) {
        alert('End time must be after start time');
        setRescheduleLoading(false);
        return;
      }

      await apiRequest(`/api/meetings/${meeting.id}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify({
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          timezone: meeting.timezone,
        }),
      });

      setReschedulingId(null);
      fetchMeetings();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule meeting');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchMeetings(1, e.target.value, statusFilter);
  };

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    fetchMeetings(1, search, filter);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const startTimeStr = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${startTimeStr} - ${endTimeStr}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white font-sans">
      {/* Navbar */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
              <Video className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
              MeetFlow
            </span>
          </div>

          <div className="flex items-center gap-4">
            {userInfo && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300">
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span>{userInfo.name || userInfo.email}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-rose-400 transition-colors border border-zinc-900 hover:border-rose-500/20 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Dashboard Title & Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Meeting Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage and schedule your Google Meet video conferences.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="self-start px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/10 transition-all flex items-center gap-2 cursor-pointer text-sm"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>Schedule Meeting</span>
          </button>
        </div>

        {/* Search, Filter & Quick Stats bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by title or description..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-white outline-none placeholder:text-zinc-650 transition-all text-sm"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-650" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'All', value: '' },
              { label: 'Scheduled', value: 'scheduled' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'Completed', value: 'completed' },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleFilterChange(btn.value)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  statusFilter === btn.value
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meetings Grid / List */}
        {loading ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-3xl bg-zinc-900/20 border border-zinc-900 p-6 space-y-4 animate-pulse">
                <div className="h-4 bg-zinc-850 rounded w-1/3"></div>
                <div className="h-6 bg-zinc-850 rounded w-3/4"></div>
                <div className="h-4 bg-zinc-850 rounded w-2/3"></div>
                <div className="h-10 bg-zinc-850 rounded w-full pt-4"></div>
              </div>
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-zinc-900/10 border border-dashed border-zinc-900 max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">No meetings found</h3>
              <p className="text-zinc-500 text-sm mt-1">Try scheduling a new meeting or adjusting your search filters.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => (
              <div 
                key={meeting.id} 
                className={`relative rounded-3xl bg-zinc-900/30 border p-6 flex flex-col justify-between min-h-[260px] hover:border-zinc-850 transition-all ${
                  meeting.status === 'cancelled' ? 'border-rose-500/10 opacity-75' : 'border-zinc-900'
                }`}
              >
                {/* Status Badge */}
                <div className="absolute top-6 right-6">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    meeting.status === 'scheduled' 
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                      : meeting.status === 'cancelled'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {meeting.status}
                  </span>
                </div>

                {/* Main details */}
                <div className="space-y-3">
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{meeting.timezone}</span>
                  </div>

                  <h3 className="text-lg font-bold pr-20 truncate text-white" title={meeting.title}>
                    {meeting.title}
                  </h3>

                  {meeting.description && (
                    <p className="text-sm text-zinc-400 line-clamp-2" title={meeting.description}>
                      {meeting.description}
                    </p>
                  )}

                  {/* Date & Time */}
                  <div className="space-y-1.5 pt-1.5 border-t border-zinc-900">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <CalendarIcon className="w-4 h-4 text-zinc-500" />
                      <span>{formatDate(meeting.start_time)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <span>{formatTimeRange(meeting.start_time, meeting.end_time)}</span>
                    </div>
                  </div>

                  {/* Attendees RSVP summary stats */}
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-xs text-zinc-400 font-semibold">
                          {meeting.attendees.length} {meeting.attendees.length === 1 ? 'guest' : 'guests'} invited
                        </span>
                      </div>
                      
                      {meeting.rsvp_stats && (
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold pl-5">
                          <span className="text-emerald-400">Accepted {meeting.rsvp_stats.accepted || 0}</span>
                          <span className="text-rose-450">Declined {meeting.rsvp_stats.declined || 0}</span>
                          <span className="text-amber-400">Tentative {meeting.rsvp_stats.tentative || 0}</span>
                          <span className="text-zinc-500">Pending {meeting.rsvp_stats.pending || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-6 mt-4 border-t border-zinc-900/60 flex items-center justify-between gap-2">
                  {reschedulingId === meeting.id ? (
                    <div className="w-full space-y-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl z-10">
                      <div className="text-xs font-semibold text-zinc-400">Reschedule Time</div>
                      <input 
                        type="date" 
                        value={newDate} 
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="time" 
                          value={newStart} 
                          onChange={(e) => setNewStart(e.target.value)}
                          className="w-1/2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-center"
                        />
                        <input 
                          type="time" 
                          value={newEnd} 
                          onChange={(e) => setNewEnd(e.target.value)}
                          className="w-1/2 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-center"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setReschedulingId(null)}
                          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md"
                          disabled={rescheduleLoading}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleRescheduleSubmit(meeting)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs rounded-md font-semibold"
                          disabled={rescheduleLoading}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => router.push(`/my-meetings/${meeting.id}`)}
                          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <span>Workspace</span>
                        </button>
                        {meeting.meet_link && meeting.status !== 'cancelled' && (
                          <>
                            <a
                              href={meeting.meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-all"
                            >
                              <span>Join</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleCopyLink(meeting.meet_link!, meeting.id)}
                              className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy Meet Link"
                            >
                              {copiedId === meeting.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>

                      {meeting.status !== 'cancelled' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => startRescheduling(meeting)}
                            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-white transition-colors cursor-pointer"
                            title="Reschedule"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCancelMeeting(meeting.id)}
                            className="p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Cancel Meeting"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-6">
            <button
              onClick={() => {
                if (page > 1) fetchMeetings(page - 1);
              }}
              disabled={page === 1}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 disabled:opacity-50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-zinc-400 font-medium">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => {
                if (page < pages) fetchMeetings(page + 1);
              }}
              disabled={page === pages}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 disabled:opacity-50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Scheduler Modal popup */}
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
