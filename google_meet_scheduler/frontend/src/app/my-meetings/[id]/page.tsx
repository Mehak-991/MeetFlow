'use strict';
'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getAuthToken } from '@/lib/api';
import {
  Calendar,
  Clock,
  Video,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  ExternalLink,
  Plus,
  Send,
  FileAudio,
  UserCheck,
  Mail,
  FileText,
  Activity,
  UserPlus,
  UserMinus
} from 'lucide-react';

interface MeetingDetail {
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
}

interface Participant {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  left_at?: string;
}

interface MeetingNote {
  id: string;
  content: string;
  created_at: string;
}

interface MeetingSummary {
  summary_text: string;
  action_items: { task: string; owner: string; priority: string }[];
  key_decisions: string[];
  created_at: string;
}

export default function MeetingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = use(params);
  const router = useRouter();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'ai'>('notes');

  // Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // AI upload states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // WebSocket / Live Room states
  const [wsConnected, setWsConnected] = useState(false);
  const [liveParticipants, setLiveParticipants] = useState<{ name: string; email: string }[]>([]);
  const [countdownText, setCountdownText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Reschedule inline state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Load meeting details
  const fetchDetails = async () => {
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}`);
      setMeeting(data.meeting);
      setParticipants(data.participants);
      setNotes(data.notes);
      setSummary(data.summary);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load meeting details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/');
      return;
    }
    fetchDetails();
  }, [meetingId, router]);

  // Handle WebSocket Connection for Live Room Simulation
  useEffect(() => {
    if (!meeting) return;

    const wsUrl = `ws://localhost:8000/api/ws/meetings/${meetingId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Send initial join
      ws.send(JSON.stringify({
        type: 'JOIN',
        name: 'Organizer (You)',
        email: meeting.organizer_email
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'JOIN') {
          setLiveParticipants(prev => {
            if (prev.some(p => p.email === data.email)) return prev;
            return [...prev, { name: data.name, email: data.email }];
          });
        } else if (data.type === 'LEAVE') {
          setLiveParticipants(prev => prev.filter(p => p.email !== data.email));
        } else if (data.type === 'TICK') {
          // Calculate remaining time
          const end = new Date(meeting.end_time).getTime();
          const now = new Date(data.timestamp).getTime();
          const diff = end - now;
          if (diff <= 0) {
            setCountdownText('Meeting ended');
          } else {
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setCountdownText(`${mins}m ${secs}s remaining`);
          }
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [meeting]);

  const handleCopyLink = () => {
    if (!meeting?.meet_link) return;
    navigator.clipboard.writeText(meeting.meet_link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;

    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteInput.trim() })
      });
      if (data.success) {
        setNotes(prev => [data.note, ...prev]);
        setNoteInput('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    }
  };

  const handleAudioUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;

    setAiProcessing(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', audioFile);

    try {
      const response = await apiRequest(`/api/meetings/${meetingId}/ai/process-audio`, {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type for FormData
      });

      if (response.success) {
        setAiResult(response);
        // Refresh meeting details to pull the new summary and notes
        fetchDetails();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process audio file.');
    } finally {
      setAiProcessing(false);
    }
  };

  // Participant Simulation Trigger
  const triggerJoinSimulation = async () => {
    const randomNames = ['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince'];
    const name = randomNames[Math.floor(Math.random() * randomNames.length)];
    const email = `${name.toLowerCase().replace(' ', '')}@example.com`;

    try {
      await apiRequest(`/api/meetings/${meetingId}/join?name=${name}&email=${email}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const triggerLeaveSimulation = async () => {
    if (liveParticipants.length <= 1) return;
    // Leave someone other than organizer
    const target = liveParticipants.find(p => p.email !== meeting?.organizer_email);
    if (!target) return;

    try {
      await apiRequest(`/api/meetings/${meetingId}/leave?email=${target.email}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Cancel Meeting
  const handleCancelMeeting = async () => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await apiRequest(`/api/meetings/${meetingId}`, { method: 'DELETE' });
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel meeting');
    }
  };

  // Start Rescheduling
  const startRescheduling = () => {
    if (!meeting) return;
    const startDateObj = new Date(meeting.start_time);
    const endDateObj = new Date(meeting.end_time);
    const yyyy = startDateObj.getFullYear();
    const mm = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(startDateObj.getDate()).padStart(2, '0');
    setNewDate(`${yyyy}-${mm}-${dd}`);
    setNewStart(startDateObj.toTimeString().substring(0, 5));
    setNewEnd(endDateObj.toTimeString().substring(0, 5));
    setIsRescheduling(true);
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    setRescheduleLoading(true);
    try {
      const startDateTime = new Date(`${newDate}T${newStart}`);
      const endDateTime = new Date(`${newDate}T${newEnd}`);

      if (endDateTime <= startDateTime) {
        alert('End time must be after start time');
        setRescheduleLoading(false);
        return;
      }

      await apiRequest(`/api/meetings/${meetingId}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify({
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          timezone: meeting?.timezone,
        }),
      });

      setIsRescheduling(false);
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule meeting');
    } finally {
      setRescheduleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-center space-y-4">
          <p className="text-rose-400">Meeting details could not be found.</p>
          <button onClick={() => router.push('/my-meetings')} className="px-5 py-2.5 bg-zinc-800 rounded-xl text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      {/* Header Bar */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center gap-4">
          <button
            onClick={() => router.push('/my-meetings')}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors border border-zinc-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Meeting Workspace</h1>
        </div>
      </nav>

      {/* Main Workspace Area */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Meeting Info & Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Badges and actions */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                meeting.status === 'scheduled' 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                  : meeting.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {meeting.status}
              </span>

              {meeting.status !== 'cancelled' && !isRescheduling && (
                <div className="flex gap-2">
                  <button
                    onClick={startRescheduling}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
                    title="Reschedule"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelMeeting}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all cursor-pointer"
                    title="Cancel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Rescheduling Form */}
            {isRescheduling && (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h4 className="text-sm font-bold text-white">Reschedule Meeting</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm" />
                  <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-center" />
                  <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-center" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsRescheduling(false)} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-xs" disabled={rescheduleLoading}>Cancel</button>
                  <button onClick={handleRescheduleSubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold" disabled={rescheduleLoading}>
                    {rescheduleLoading ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight">{meeting.title}</h2>
              {meeting.description && <p className="text-zinc-400 text-sm leading-relaxed">{meeting.description}</p>}
            </div>

            {/* Date Time info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-zinc-900 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Date</div>
                  <div className="font-semibold">{new Date(meeting.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Time Slot</div>
                  <div className="font-semibold">
                    {new Date(meeting.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.end_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({meeting.timezone})
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {meeting.status !== 'cancelled' && meeting.meet_link && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Video className="w-5 h-5" />
                  <span>Join Google Meet</span>
                  <ExternalLink className="w-4.5 h-4.5" />
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-5 py-3.5 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Attendees List */}
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
            <h3 className="text-lg font-bold">Attendees</h3>
            <div className="space-y-3">
              {/* Host */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold text-sm">
                    {meeting.organizer_email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{meeting.organizer_email}</div>
                    <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Host</div>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Accepted
                </span>
              </div>

              {/* Invited Guests */}
              {meeting.attendees && meeting.attendees.map(email => (
                <div key={email} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-900">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800 font-bold text-sm">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-semibold text-sm">{email}</div>
                  </div>
                  <span className="text-xs text-zinc-500 font-medium">Invited</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Room (WebSockets) */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 flex flex-col justify-between min-h-[360px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <span>Live Room</span>
                </h3>
                <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
              </div>

              {/* Countdown Timer */}
              <div className="p-4 rounded-2xl bg-zinc-950 text-center border border-zinc-800">
                <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Remaining Time</div>
                <div className="text-xl font-mono font-bold mt-1 text-indigo-400">
                  {countdownText || 'Calculating...'}
                </div>
              </div>

              {/* Live Participants list */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active in Call ({liveParticipants.length})</div>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {liveParticipants.length === 0 ? (
                    <div className="text-zinc-600 text-xs py-4 text-center">Waiting for participants...</div>
                  ) : (
                    liveParticipants.map(lp => (
                      <div key={lp.email} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950/60 border border-zinc-900/80">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                          {lp.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate text-white">{lp.name}</div>
                          <div className="text-[10px] text-zinc-500 truncate">{lp.email}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Simulators */}
            <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2 mt-4">
              <div className="text-[10px] uppercase font-bold text-zinc-550 tracking-wider">Simulation Controls</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={triggerJoinSimulation}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Join Guest</span>
                </button>
                <button
                  onClick={triggerLeaveSimulation}
                  disabled={liveParticipants.length <= 1}
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800 disabled:opacity-50"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Leave Guest</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tabs / Bottom Section: Notes & AI Intelligence */}
      <section className="max-w-7xl mx-auto w-full px-6 pb-16">
        <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
          
          {/* Tab buttons */}
          <div className="flex border-b border-zinc-900 pb-3 gap-4">
            <button
              onClick={() => setActiveTab('notes')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'notes' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Meeting Notes & History
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'ai' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              AI Insights & Whisper Transcription
            </button>
          </div>

          {/* Notes Tab Content */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add note input */}
              <form onSubmit={handleAddNote} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type a new note/comment about this meeting..."
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>

              {/* Notes List */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {notes.length === 0 ? (
                  <div className="text-zinc-500 text-sm py-6 text-center">No notes recorded yet.</div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900/60 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="font-semibold">Note Log</span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* AI Intelligence / Whisper Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* File upload section */}
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">Upload Meeting Recording</h4>
                  <p className="text-zinc-500 text-xs">Supports MP3, MP4, WAV or M4A format up to 25MB.</p>
                </div>
                
                <input
                  type="file"
                  accept="audio/*"
                  onChange={e => setAudioFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-300 hover:file:bg-zinc-800 cursor-pointer"
                />

                {audioFile && (
                  <button
                    onClick={handleAudioUpload}
                    disabled={aiProcessing}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/10 flex items-center gap-2"
                  >
                    {aiProcessing && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    <span>{aiProcessing ? 'Transcribing & Summarizing...' : 'Start AI Analysis'}</span>
                  </button>
                )}
              </div>

              {/* AI Summary and Follow-up Results */}
              {(aiResult || summary) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* Summary, decisions, and action items */}
                  <div className="space-y-5">
                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900/60 space-y-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span>AI Meeting Summary</span>
                      </h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {aiResult ? aiResult.summary : summary?.summary_text}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900/60 space-y-3">
                      <h4 className="text-sm font-bold text-white">Key Decisions</h4>
                      <ul className="list-disc pl-5 text-xs text-zinc-400 space-y-1.5">
                        {(aiResult ? aiResult.key_decisions : summary?.key_decisions)?.map((decision: string, idx: number) => (
                          <li key={idx}>{decision}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900/60 space-y-3">
                      <h4 className="text-sm font-bold text-white">Action Items</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-zinc-900 text-zinc-550">
                              <th className="py-2">Task</th>
                              <th className="py-2">Owner</th>
                              <th className="py-2">Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(aiResult ? aiResult.action_items : summary?.action_items)?.map((item: any, idx: number) => (
                              <tr key={idx} className="border-b border-zinc-900/40 text-zinc-400">
                                <td className="py-2.5 font-medium">{item.task}</td>
                                <td className="py-2.5">{item.owner}</td>
                                <td className="py-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.priority?.toLowerCase() === 'high' 
                                      ? 'bg-rose-500/10 text-rose-400' 
                                      : 'bg-zinc-800 text-zinc-450'
                                  }`}>
                                    {item.priority}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Email Draft */}
                  <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900/60 flex flex-col justify-between min-h-[300px]">
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white flex items-center justify-between">
                        <span>Follow-up Email Draft</span>
                        <button
                          onClick={() => {
                            const emailBody = aiResult ? aiResult.email_draft : '';
                            if (emailBody) {
                              navigator.clipboard.writeText(emailBody);
                              setCopiedEmail(true);
                              setTimeout(() => setCopiedEmail(false), 2000);
                            }
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                        >
                          {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                        </button>
                      </h4>
                      
                      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900 text-xs font-mono text-zinc-400 whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                        {aiResult ? aiResult.email_draft : 'Process audio to generate email follow-up draft.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}
