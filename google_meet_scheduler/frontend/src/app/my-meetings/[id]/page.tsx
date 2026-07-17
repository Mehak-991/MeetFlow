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
  BarChart2,
  UserPlus,
  UserMinus,
  AlertCircle,
  X,
  MoreVertical,
  Mic,
  MicOff,
  VideoOff,
  User,
  ShieldCheck,
  Info,
  Menu,
  PhoneOff,
  MessageSquare,
  Monitor,
  Hand,
  Subtitles,
  Disc,
  Settings,
  Volume2,
  VolumeX,
  Pin,
  Smile,
  Eye
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
  response_status?: string;
  invitation_sent?: boolean;
  invitation_sent_at?: string;
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

  // Guest modification states
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false);
  const [inviteChips, setInviteChips] = useState<string[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [emailActionLoading, setEmailActionLoading] = useState(false);
  const [invitedSuccessfully, setInvitedSuccessfully] = useState('');

  // WebSocket / Live Room states
  const [wsConnected, setWsConnected] = useState(false);
  const [liveParticipants, setLiveParticipants] = useState<{ name: string; email: string; mic?: boolean; camera?: boolean; handRaise?: boolean; screenShare?: boolean; speaking?: boolean }[]>([]);
  const [countdownText, setCountdownText] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Reschedule inline state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // High fidelity UI states
  const [activeMenuEmail, setActiveMenuEmail] = useState<string | null>(null);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  // Real-time video call workspace states
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeSpeakerEmail, setActiveSpeakerEmail] = useState<string | null>(null);
  const [pinnedEmail, setPinnedEmail] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; email: string; text: string; timestamp: string }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'people' | 'chat'>('people');
  const [waitingRoomGuests, setWaitingRoomGuests] = useState<{ name: string; email: string }[]>([]);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionsText, setCaptionsText] = useState('');
  const [chatInputText, setChatInputText] = useState('');

  // Device settings states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('FaceTime HD Camera (Built-in)');
  const [selectedMic, setSelectedMic] = useState('MacBook Pro Microphone (Built-in)');
  const [selectedResolution, setSelectedResolution] = useState('720p (HD)');
  const [selectedFrameRate, setSelectedFrameRate] = useState('30 fps');
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  // Active speaker simulator rotation
  useEffect(() => {
    if (!isInCall || !meeting) return;
    const interval = setInterval(() => {
      const candidates = [meeting.organizer_email, ...liveParticipants.map(p => p.email)].filter(Boolean);
      if (candidates.length > 0) {
        const randomEmail = candidates[Math.floor(Math.random() * candidates.length)];
        setActiveSpeakerEmail(randomEmail);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isInCall, liveParticipants, meeting]);

  // AI Copilot Control Center states
  const [workspaceTab, setWorkspaceTab] = useState<'details' | 'transcript' | 'summary' | 'action-items' | 'insights' | 'recordings' | 'settings' | 'automation'>('details');
  
  const handleTriggerWorkflow = async (target: string) => {
    try {
      const data = await apiRequest(`/api/integrations/meetings/${meetingId}/trigger`, {
        method: 'POST',
        body: JSON.stringify({ target })
      });
      alert(data.message);
    } catch (e) {
      console.error(e);
    }
  };

  const [transcriptsList, setTranscriptsList] = useState<{ id: string; speaker: string; text: string; timestamp: string }[]>([]);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [transcriptSpeakerFilter, setTranscriptSpeakerFilter] = useState('');
  const [actionItemsList, setActionItemsList] = useState<{ id: string; task: string; owner: string; deadline: string; priority: string; status: string }[]>([]);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [aiSettingsData, setAiSettingsData] = useState<any>({
    summary_style: 'detailed',
    transcript_language: 'en',
    auto_summary: true,
    auto_email: true,
    auto_export: false,
    ai_model: 'gpt-4o-mini'
  });

  const fetchTranscripts = async () => {
    try {
      const url = `/api/meetings/${meetingId}/ai/transcripts?query=${encodeURIComponent(transcriptSearch)}&speaker=${encodeURIComponent(transcriptSpeakerFilter)}`;
      const data = await apiRequest(url);
      setTranscriptsList(data);
    } catch (e) {
      console.error('Failed to load transcripts:', e);
    }
  };

  const fetchActionItems = async () => {
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/ai/action-items`);
      setActionItemsList(data);
    } catch (e) {
      console.error('Failed to load action items:', e);
    }
  };

  const fetchInsights = async () => {
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/ai/insights`);
      setInsightsData(data);
    } catch (e) {
      console.error('Failed to load insights:', e);
    }
  };

  const fetchAISettings = async () => {
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/ai/settings`);
      setAiSettingsData(data);
    } catch (e) {
      console.error('Failed to load AI settings:', e);
    }
  };

  const handleUpdateActionItem = async (itemId: string, status: string) => {
    try {
      await apiRequest(`/api/meetings/${meetingId}/ai/action-items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchActionItems();
    } catch (e) {
      console.error('Failed to update action item:', e);
    }
  };

  const handleUpdateAISettings = async (updatedFields: any) => {
    try {
      await apiRequest(`/api/meetings/${meetingId}/ai/settings`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      });
      setAiSettingsData((prev: any) => prev ? { ...prev, ...updatedFields } : null);
      alert('AI settings updated successfully!');
    } catch (e) {
      console.error('Failed to update AI settings:', e);
    }
  };

  const handleExportData = (format: string) => {
    try {
      const token = getAuthToken();
      window.open(`http://localhost:8000/api/meetings/${meetingId}/ai/export?format=${format}&token=${token}`, '_blank');
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  // Load tab data lazily
  useEffect(() => {
    if (workspaceTab === 'transcript') {
      fetchTranscripts();
    } else if (workspaceTab === 'action-items') {
      fetchActionItems();
    } else if (workspaceTab === 'insights') {
      fetchInsights();
    } else if (workspaceTab === 'settings') {
      fetchAISettings();
    }
  }, [workspaceTab, transcriptSearch, transcriptSpeakerFilter]);

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

  const handleAddChip = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const email = inviteEmailInput.trim().toLowerCase().replace(/,/g, '');
      if (!email) return;

      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(email)) {
        setErrorMsg('Please enter a valid email address');
        return;
      }

      if (inviteChips.includes(email)) {
        setErrorMsg('This email is already in the list');
        return;
      }

      if (participants.some(p => p.email.toLowerCase() === email)) {
        setErrorMsg('This guest has already been invited');
        return;
      }

      setInviteChips([...inviteChips, email]);
      setInviteEmailInput('');
      setErrorMsg('');
    }
  };

  const handleRemoveChip = (indexToRemove: number) => {
    setInviteChips(inviteChips.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSendBulkInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there is an unadded email in the input and try to add it
    let finalChips = [...inviteChips];
    const remainingEmail = inviteEmailInput.trim().toLowerCase().replace(/,/g, '');
    if (remainingEmail) {
      const emailRegex = /\S+@\S+\.\S+/;
      if (emailRegex.test(remainingEmail) && !finalChips.includes(remainingEmail) && !participants.some(p => p.email.toLowerCase() === remainingEmail)) {
        finalChips.push(remainingEmail);
        setInviteEmailInput('');
      }
    }

    if (finalChips.length === 0) {
      setErrorMsg('Please add at least one guest email');
      return;
    }

    setEmailActionLoading(true);
    setErrorMsg('');
    setInvitedSuccessfully('');
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/attendees`, {
        method: 'POST',
        body: JSON.stringify({ emails: finalChips })
      });
      if (data.success) {
        setInviteChips([]);
        setInvitedSuccessfully('Invitation emails dispatched successfully!');
        setShowAddPeopleModal(false);
        fetchDetails();
        setTimeout(() => setInvitedSuccessfully(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch invitations');
    } finally {
      setEmailActionLoading(false);
    }
  };

  const handleRemoveGuest = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this meeting?`)) return;
    
    setEmailActionLoading(true);
    setErrorMsg('');
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/attendees`, {
        method: 'DELETE',
        body: JSON.stringify({ emails: [email] })
      });
      if (data.success) {
        fetchDetails();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove guest');
    } finally {
      setEmailActionLoading(false);
    }
  };

  const handleResendInvitation = async (email: string) => {
    setEmailActionLoading(true);
    setErrorMsg('');
    setInvitedSuccessfully('');
    try {
      const data = await apiRequest(`/api/meetings/${meetingId}/resend-invitation`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (data.success) {
        setInvitedSuccessfully(`Invitation successfully resent to ${email}`);
        setTimeout(() => setInvitedSuccessfully(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend invitation');
    } finally {
      setEmailActionLoading(false);
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
            return [...prev, { name: data.name, email: data.email, mic: true, camera: true }];
          });
        } else if (data.type === 'LEAVE') {
          setLiveParticipants(prev => prev.filter(p => p.email !== data.email));
        } else if (data.type === 'RSVP_UPDATE') {
          console.log('[WS] Received RSVP_UPDATE notification. Refetching participant statuses...');
          fetchDetails();
        } else if (data.type === 'CHAT_MESSAGE') {
          setChatMessages(prev => [
            ...prev,
            {
              id: data.id || Math.random().toString(),
              sender: data.sender || 'Guest',
              email: data.email,
              text: data.text,
              timestamp: data.timestamp || new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        } else if (data.type === 'STATE_SYNC') {
          setLiveParticipants(prev =>
            prev.map(p => {
              if (p.email.toLowerCase() === data.email.toLowerCase()) {
                return {
                  ...p,
                  mic: data.mic !== undefined ? data.mic : p.mic,
                  camera: data.camera !== undefined ? data.camera : p.camera,
                  handRaise: data.handRaise !== undefined ? data.handRaise : p.handRaise,
                  screenShare: data.screenShare !== undefined ? data.screenShare : p.screenShare,
                  speaking: data.speaking !== undefined ? data.speaking : p.speaking
                };
              }
              return p;
            })
          );
        } else if (data.type === 'WAITING_REQUEST') {
          setWaitingRoomGuests(prev => {
            if (prev.some(g => g.email === data.email)) return prev;
            return [...prev, { name: data.name, email: data.email }];
          });
        } else if (data.type === 'SPEAKING_DETECTED') {
          setActiveSpeakerEmail(data.email);
        } else if (data.type === 'RECORDING_STATE') {
          setIsRecording(data.recording);
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

  // Helper to extract meeting code from Google Meet link
  const getMeetingCode = () => {
    if (!meeting?.meet_link) return meetingId;
    const parts = meeting.meet_link.split('/');
    return parts[parts.length - 1];
  };

  // Render helper for Google Meet style People Panel
  const renderPeoplePanel = () => {
    return (
      <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">People Panel</h3>
          <span className="text-xs text-zinc-450 font-semibold">{participants.length} invited</span>
        </div>

        {/* Guest Search and Add Button */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search guests..."
            value={guestSearchQuery}
            onChange={e => setGuestSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none"
          />
          {meeting.status !== 'cancelled' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setErrorMsg('');
                setInviteChips([]);
                setInviteEmailInput('');
                setShowAddPeopleModal(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>

        {invitedSuccessfully && (
          <div className="text-emerald-400 text-xs font-semibold px-1">
            {invitedSuccessfully}
          </div>
        )}

        <div className="space-y-3 pt-2 max-h-[400px] overflow-y-auto pr-1">
          {/* Host / Organizer (Only show if matches search query) */}
          {(!guestSearchQuery || meeting.organizer_email.toLowerCase().includes(guestSearchQuery.toLowerCase())) && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 font-bold text-sm">
                  {meeting.organizer_email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-white truncate max-w-[140px]" title={meeting.organizer_email}>
                    {meeting.organizer_email.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{meeting.organizer_email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-indigo-505/10 text-indigo-400 border border-indigo-500/20">
                  Host
                </span>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          )}

          {/* Invited Guests (Filtered by guestSearchQuery) */}
          {participants
            .filter(p => p.email.toLowerCase() !== meeting.organizer_email.toLowerCase())
            .filter(p => !guestSearchQuery || p.email.toLowerCase().includes(guestSearchQuery.toLowerCase()) || (p.name && p.name.toLowerCase().includes(guestSearchQuery.toLowerCase())))
            .map(p => (
              <div key={p.email} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-900 group relative">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800 font-bold text-sm flex-shrink-0">
                    {p.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate text-white" title={p.name || p.email}>{p.name || p.email.split('@')[0]}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{p.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Mic / Camera simulations */}
                  <div className="flex gap-1">
                    <Mic className="w-3.5 h-3.5 text-zinc-500" />
                    <Video className="w-3.5 h-3.5 text-zinc-500" />
                  </div>

                  {/* RSVP status badge with visual icons */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    p.response_status === 'accepted'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : p.response_status === 'declined'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : p.response_status === 'tentative'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-zinc-850 text-zinc-400 border border-zinc-750'
                  }`}>
                    {p.response_status === 'accepted' && <span>✔ Accepted</span>}
                    {p.response_status === 'declined' && <span>❌ Declined</span>}
                    {p.response_status === 'tentative' && <span>🟡 Tentative</span>}
                    {(p.response_status === 'needsAction' || !p.response_status) && <span>⏳ Pending</span>}
                  </span>

                  {/* Three dot actions trigger dropdown */}
                  {meeting.status !== 'cancelled' && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuEmail(activeMenuEmail === p.email ? null : p.email);
                        }}
                        className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-850"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      
                      {activeMenuEmail === p.email && (
                        <div className="absolute right-0 mt-1.5 w-40 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-20 py-1 font-sans text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendInvitation(p.email);
                              setActiveMenuEmail(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center gap-2 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Resend Invite</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(p.email);
                              alert('Email copied to clipboard!');
                              setActiveMenuEmail(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Email</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfile(p);
                              setActiveMenuEmail(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center gap-2 cursor-pointer"
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>View Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveGuest(p.email);
                              setActiveMenuEmail(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-rose-400 hover:text-rose-350 flex items-center gap-2 cursor-pointer border-t border-zinc-900"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove Guest</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  // Call actions
  const toggleMic = () => {
    const nextVal = !isMuted;
    setIsMuted(nextVal);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_SYNC',
        email: meeting?.organizer_email,
        mic: !nextVal
      }));
    }
  };

  const toggleCam = () => {
    const nextVal = !isCamOff;
    setIsCamOff(nextVal);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_SYNC',
        email: meeting?.organizer_email,
        camera: !nextVal
      }));
    }
  };

  const toggleScreenShare = () => {
    const nextVal = !isScreenSharing;
    setIsScreenSharing(nextVal);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_SYNC',
        email: meeting?.organizer_email,
        screenShare: nextVal
      }));
    }
  };

  const toggleHandRaise = () => {
    const nextVal = !isHandRaised;
    setIsHandRaised(nextVal);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_SYNC',
        email: meeting?.organizer_email,
        handRaise: nextVal
      }));
    }
  };

  const toggleRecording = () => {
    const nextVal = !isRecording;
    setIsRecording(nextVal);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'RECORDING_STATE',
        recording: nextVal
      }));
    }
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim()) return;
    const msg = {
      type: 'CHAT_MESSAGE',
      sender: 'Organizer (You)',
      email: meeting?.organizer_email || '',
      text: chatInputText,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'Organizer (You)',
        email: meeting?.organizer_email || '',
        text: chatInputText,
        timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setChatInputText('');
  };

  const handleApproveGuest = (email: string) => {
    setWaitingRoomGuests(prev => prev.filter(g => g.email !== email));
    const guest = waitingRoomGuests.find(g => g.email === email);
    if (guest) {
      setLiveParticipants(prev => [
        ...prev,
        { name: guest.name, email: guest.email, mic: true, camera: true }
      ]);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'JOIN',
          name: guest.name,
          email: guest.email
        }));
      }
    }
  };

  const handleRejectGuest = (email: string) => {
    setWaitingRoomGuests(prev => prev.filter(g => g.email !== email));
  };

  const handleApproveAll = () => {
    waitingRoomGuests.forEach(g => {
      setLiveParticipants(prev => {
        if (prev.some(p => p.email === g.email)) return prev;
        return [...prev, { name: g.name, email: g.email, mic: true, camera: true }];
      });
    });
    setWaitingRoomGuests([]);
  };

  const handleMuteParticipant = (email: string) => {
    setLiveParticipants(prev =>
      prev.map(p => {
        if (p.email === email) {
          return { ...p, mic: false };
        }
        return p;
      })
    );
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STATE_SYNC',
        email: email,
        mic: false
      }));
    }
  };

  const renderCallRoom = () => {
    const activeTiles = [
      {
        email: meeting?.organizer_email || '',
        name: "You (Host)",
        mic: !isMuted,
        camera: !isCamOff,
        handRaise: isHandRaised,
        screenShare: isScreenSharing,
        speaking: activeSpeakerEmail === meeting?.organizer_email,
        isHost: true
      },
      ...liveParticipants.map(lp => ({
        email: lp.email,
        name: lp.name,
        mic: lp.mic !== false,
        camera: lp.camera !== false,
        handRaise: !!lp.handRaise,
        screenShare: !!lp.screenShare,
        speaking: activeSpeakerEmail === lp.email,
        isHost: false
      }))
    ];

    let gridColsClass = "grid-cols-1";
    if (activeTiles.length === 2) {
      gridColsClass = "grid-cols-1 md:grid-cols-2";
    } else if (activeTiles.length >= 3 && activeTiles.length <= 4) {
      gridColsClass = "grid-cols-2";
    } else if (activeTiles.length >= 5) {
      gridColsClass = "grid-cols-2 lg:grid-cols-3";
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col justify-between overflow-hidden">
        {/* In-Call Header */}
        <header className="border-b border-zinc-900 bg-zinc-950/80 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsInCall(false);
                setCountdownText('');
              }}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors border border-zinc-900 cursor-pointer"
              title="Leave call back to details panel"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-white truncate max-w-[200px] leading-tight">{meeting?.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Connected</span>
                {isRecording && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full ml-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                    <span>REC</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-zinc-500 font-mono hidden md:inline">{countdownText || "00:00"}</span>
            <span className="text-zinc-500">|</span>
            <span className="text-indigo-400 tracking-wider font-mono">{getMeetingCode()}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(meeting?.meet_link || window.location.href);
                alert("Meeting link copied!");
              }}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-white border border-zinc-900 transition-colors cursor-pointer"
              title="Copy Meeting Link"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-white border border-zinc-900 transition-colors cursor-pointer"
              title="Device Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Video Grid & Sidebar Panels */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 overflow-y-auto">
          <div className={`${showSidebar ? 'lg:col-span-3' : 'lg:col-span-4'} flex flex-col justify-center min-h-[50vh]`}>
            <div className={`grid ${gridColsClass} gap-4 w-full h-full`}>
              {activeTiles.map((tile) => {
                const isPinned = pinnedEmail === tile.email;
                const isSpeaking = tile.speaking;
                const colSpanClass = isPinned ? 'col-span-2 row-span-2' : '';
                return (
                  <div
                    key={tile.email}
                    onClick={() => setActiveSpeakerEmail(tile.email)}
                    className={`relative rounded-3xl bg-zinc-900 border transition-all duration-300 overflow-hidden flex flex-col items-center justify-center min-h-[220px] cursor-pointer group ${colSpanClass} ${
                      isSpeaking 
                        ? 'border-indigo-500 shadow-lg shadow-indigo-500/10 scale-[1.01]' 
                        : 'border-zinc-850 hover:border-zinc-800'
                    }`}
                  >
                    {tile.camera ? (
                      <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center">
                        <div className="text-[10px] text-zinc-505 uppercase tracking-widest animate-pulse flex flex-col items-center gap-1">
                          <Eye className="w-5 h-5 text-indigo-400" />
                          <span>Streaming Feed ({selectedResolution})</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-zinc-950/80 border border-zinc-850/60 flex items-center justify-center text-zinc-400 font-extrabold text-2xl uppercase select-none">
                        {tile.name.charAt(0)}
                      </div>
                    )}

                    <div className="absolute top-4 right-4 flex gap-1.5">
                      {!tile.mic && (
                        <div className="p-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
                          <MicOff className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {tile.handRaise && (
                        <div className="p-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-bounce">
                          <Hand className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {tile.screenShare && (
                        <div className="p-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                          <Monitor className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-zinc-900">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{tile.name}</span>
                        {tile.isHost && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Host
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedEmail(isPinned ? null : tile.email);
                          }}
                          className={`p-1 rounded bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                            isPinned ? 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5' : ''
                          }`}
                          title={isPinned ? 'Unpin' : 'Pin User'}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {captionsEnabled && (
              <div className="mt-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-850 text-center max-w-2xl mx-auto backdrop-blur-sm animate-fade-in">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Live Captions (English)</div>
                <p className="text-sm font-semibold text-zinc-200">
                  {captionsText || "[Silence - Waiting for speech detection...]"}
                </p>
              </div>
            )}
          </div>

          {showSidebar && (
            <aside className="lg:col-span-1 rounded-3xl bg-zinc-900/40 border border-zinc-900 p-5 flex flex-col h-full min-h-[400px] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex border-b border-zinc-900 pb-3 mb-4 gap-4 flex-shrink-0">
                <button
                  onClick={() => setSidebarTab('people')}
                  className={`pb-1 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    sidebarTab === 'people' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  People ({activeTiles.length})
                </button>
                <button
                  onClick={() => setSidebarTab('chat')}
                  className={`pb-1 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    sidebarTab === 'chat' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-550 hover:text-zinc-350'
                  }`}
                >
                  Chat ({chatMessages.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                {sidebarTab === 'people' ? (
                  <div className="space-y-4">
                    {waitingRoomGuests.length > 0 && (
                      <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] text-amber-400 font-bold uppercase">Waiting Room ({waitingRoomGuests.length})</h4>
                          <button
                            onClick={handleApproveAll}
                            className="text-[9px] text-white hover:text-indigo-400 font-bold"
                          >
                            Approve All
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {waitingRoomGuests.map(g => (
                            <div key={g.email} className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-900 text-xs">
                              <span className="font-semibold text-zinc-300 truncate max-w-[100px]">{g.name}</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleApproveGuest(g.email)}
                                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9px] font-bold cursor-pointer"
                                >
                                  Admit
                                </button>
                                <button
                                  onClick={() => handleRejectGuest(g.email)}
                                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 rounded text-[9px] cursor-pointer"
                                >
                                  Deny
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">In Call</div>
                      <div className="space-y-2">
                        {activeTiles.map(tile => (
                          <div key={tile.email} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800 text-xs font-bold flex-shrink-0">
                                {tile.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate text-white">{tile.name}</div>
                                <div className="text-[9px] text-zinc-500 truncate">{tile.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {tile.mic ? (
                                <Mic className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <MicOff className="w-3.5 h-3.5 text-rose-500" />
                              )}
                              {!tile.isHost && (
                                <button
                                  onClick={() => handleMuteParticipant(tile.email)}
                                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-450 hover:text-white transition-colors cursor-pointer"
                                  title="Remote Mute Participant"
                                >
                                  <VolumeX className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full min-h-[300px]">
                    <div className="flex-1 overflow-y-auto space-y-3 min-h-0 mb-3 pr-1">
                      {chatMessages.length === 0 ? (
                        <div className="text-zinc-650 text-xs py-8 text-center bg-zinc-950/10 rounded-2xl border border-zinc-900 border-dashed">
                          No messages yet. Start chatting!
                        </div>
                      ) : (
                        chatMessages.map(msg => (
                          <div key={msg.id} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-900 flex flex-col gap-1 text-xs relative group">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-semibold">
                              <span className="text-indigo-400">{msg.sender}</span>
                              <span>{msg.timestamp}</span>
                            </div>
                            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            
                            {msg.sender === 'Organizer (You)' && (
                              <button
                                onClick={() => setChatMessages(prev => prev.filter(m => m.id !== msg.id))}
                                className="absolute right-2 top-2 p-0.5 rounded hover:bg-zinc-900 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Delete Message"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 justify-center py-1 bg-zinc-950 border border-zinc-900 rounded-t-xl px-2">
                      {['👍', '👏', '💖', '😂', '😮', '😢'].map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setChatInputText(prev => prev + e)}
                          className="hover:scale-125 transition-transform text-xs cursor-pointer"
                        >
                          {e}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleSendChat} className="flex gap-2 bg-zinc-950 p-2 rounded-b-xl border-x border-b border-zinc-900">
                      <input
                        type="text"
                        placeholder="Send message..."
                        value={chatInputText}
                        onChange={e => setChatInputText(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-white border-none outline-none py-1.5 px-1"
                      />
                      <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white cursor-pointer">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Floating Bottom Control Bar */}
        <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-4 flex items-center justify-between sticky bottom-0 z-40">
          <div className="text-[10px] text-zinc-500 font-bold font-mono tracking-wider hidden sm:inline">
            MeetFlow Room Call
          </div>

          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                isMuted 
                  ? 'bg-rose-600 text-white border-rose-500' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleCam}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                isCamOff 
                  ? 'bg-rose-600 text-white border-rose-500' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                isScreenSharing 
                  ? 'bg-indigo-600 text-white border-indigo-500' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={isScreenSharing ? 'Stop Screen Sharing' : 'Start Screen Sharing'}
            >
              <Monitor className="w-4 h-4" />
            </button>

            <button
              onClick={toggleHandRaise}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                isHandRaised 
                  ? 'bg-amber-600 text-white border-amber-500' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const nextVal = !captionsEnabled;
                setCaptionsEnabled(nextVal);
                if (nextVal) {
                  setCaptionsText("Welcome to the live session workspace. Speech transcription has been successfully enabled.");
                } else {
                  setCaptionsText("");
                }
              }}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                captionsEnabled 
                  ? 'bg-indigo-600 text-white border-indigo-500' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title="Toggle Live Captions"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            <button
              onClick={toggleRecording}
              className={`p-3 rounded-full border transition-all cursor-pointer ${
                isRecording 
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title="Record Meeting"
            >
              <Disc className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsInCall(false);
                setCountdownText('');
              }}
              className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-full border border-rose-500 cursor-pointer shadow-lg shadow-rose-600/20"
              title="Leave Room"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setShowSidebar(!showSidebar);
                setSidebarTab('people');
              }}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5 ${
                showSidebar && sidebarTab === 'people'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
              }`}
              title="Participants list"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline">People</span>
            </button>

            <button
              onClick={() => {
                setShowSidebar(!showSidebar);
                setSidebarTab('chat');
              }}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5 ${
                showSidebar && sidebarTab === 'chat'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
              }`}
              title="Chat box"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">Chat</span>
            </button>
          </div>
        </footer>

        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 flex-shrink-0">
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  <span>Audio & Video Settings</span>
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">Select Camera</label>
                  <select
                    value={selectedCamera}
                    onChange={e => setSelectedCamera(e.target.value)}
                    className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                  >
                    <option value="FaceTime HD Camera (Built-in)">FaceTime HD Camera (Built-in)</option>
                    <option value="Logitech Brio Stream Cam">Logitech Brio Stream Cam (External)</option>
                    <option value="OBS Virtual Camera Feed">OBS Virtual Camera Feed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">Select Microphone</label>
                  <select
                    value={selectedMic}
                    onChange={e => setSelectedMic(e.target.value)}
                    className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                  >
                    <option value="MacBook Pro Microphone (Built-in)">MacBook Pro Microphone (Built-in)</option>
                    <option value="Yeti USB Stereo Microphone">Yeti USB Stereo Microphone</option>
                    <option value="AirPods Pro Stereo Input">AirPods Pro Stereo Input</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">Resolution</label>
                    <select
                      value={selectedResolution}
                      onChange={e => setSelectedResolution(e.target.value)}
                      className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                    >
                      <option value="1080p (Full HD)">1080p (Full HD)</option>
                      <option value="720p (HD)">720p (HD)</option>
                      <option value="360p (SD)">360p (SD)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-550 font-bold uppercase tracking-wider text-[10px]">Frame Rate</label>
                    <select
                      value={selectedFrameRate}
                      onChange={e => setSelectedFrameRate(e.target.value)}
                      className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                    >
                      <option value="60 fps">60 fps</option>
                      <option value="30 fps">30 fps</option>
                      <option value="15 fps">15 fps</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-semibold">Echo Cancellation</span>
                    <input
                      type="checkbox"
                      checked={echoCancellation}
                      onChange={e => setEchoCancellation(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-semibold">Noise Suppression (AI)</span>
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={e => setNoiseSuppression(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Save settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Close menus when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuEmail(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  if (isInCall) {
    return renderCallRoom();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      {/* Header Bar */}
      <nav className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/my-meetings')}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors border border-zinc-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                {meeting.title}
              </h1>
              <div className="text-[10px] text-zinc-500 font-semibold mt-1">
                Code: {getMeetingCode()} | Status: {meeting.status}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileDrawer(true)}
              className="lg:hidden p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-450 hover:text-white border border-zinc-900 flex items-center gap-1.5 text-xs font-bold"
            >
              <Menu className="w-4.5 h-4.5" />
              <span>People ({participants.length})</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1">
        
        {/* Left Side: Copilot Control Center Navbar (Col 1) */}
        <div className="lg:col-span-1 space-y-2 flex flex-col">
          {[
            { id: 'details', label: 'Details Workspace', icon: FileText },
            { id: 'transcript', label: 'Transcript & Search', icon: FileAudio },
            { id: 'summary', label: 'AI Summary & Email', icon: Mail },
            { id: 'action-items', label: 'Action Items', icon: UserCheck },
            { id: 'insights', label: 'Meeting Insights', icon: Activity },
            { id: 'recordings', label: 'Recordings', icon: Video },
            { id: 'settings', label: 'AI Settings', icon: Settings },
            { id: 'automation', label: 'Workflow Automation', icon: BarChart2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setWorkspaceTab(tab.id as any)}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                workspaceTab === tab.id
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                  : 'bg-zinc-900/30 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right Side: Tab Panel Content (Col 2, 3, 4 -> ColSpan 3) */}
        <div className="lg:col-span-3 space-y-6">
          
          {workspaceTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Meeting Info & Management (Original Left Column) */}
              <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

                {/* Badges and reschedule actions */}
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
                        title="Reschedule Time slot"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelMeeting}
                        className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all cursor-pointer"
                        title="Cancel Meeting"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {isRescheduling && (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 space-y-4">
                    <h4 className="text-sm font-bold text-white">Reschedule Meeting</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-550 font-bold uppercase">Date</label>
                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-550 font-bold uppercase">Start</label>
                          <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white text-center" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-550 font-bold uppercase">End</label>
                          <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white text-center" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setIsRescheduling(false)} className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-855 rounded-xl text-xs" disabled={rescheduleLoading}>Cancel</button>
                      <button onClick={handleRescheduleSubmit} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold" disabled={rescheduleLoading}>
                        {rescheduleLoading ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">About Meeting</h3>
                    <h2 className="text-xl font-extrabold tracking-tight mt-1 text-white">{meeting.title}</h2>
                    {meeting.description && <p className="text-zinc-400 text-xs mt-2 leading-relaxed whitespace-pre-wrap">{meeting.description}</p>}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-zinc-900 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Organizer:</span>
                      <span className="font-semibold text-zinc-300 truncate max-w-[160px]">{meeting.organizer_email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Date:</span>
                      <span className="font-semibold text-zinc-300">
                        {new Date(meeting.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Time:</span>
                      <span className="font-semibold text-zinc-300">
                        {new Date(meeting.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(meeting.end_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Timezone:</span>
                      <span className="font-semibold text-zinc-300 truncate max-w-[120px]">{meeting.timezone}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Duration:</span>
                      <span className="font-semibold text-zinc-300">
                        {Math.round((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / 60000)} mins
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/40">
                      <span className="text-zinc-500">Meeting Code:</span>
                      <span className="font-semibold text-indigo-400 select-all">{getMeetingCode()}</span>
                    </div>
                    {meeting.calendar_event_id && (
                      <div className="flex flex-col gap-1 py-1">
                        <span className="text-zinc-550">Calendar Event ID:</span>
                        <span className="font-mono text-[10px] text-zinc-400 truncate select-all">{meeting.calendar_event_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Call access buttons */}
                <div className="space-y-2 pt-2">
                  {meeting.status !== 'cancelled' && (
                    <button
                      onClick={() => setIsInCall(true)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
                    >
                      <Video className="w-4 h-4 animate-pulse" />
                      <span>Join MeetFlow Call (Active Grid)</span>
                    </button>
                  )}
                  {meeting.status !== 'cancelled' && meeting.meet_link && (
                    <a
                      href={meeting.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
                    >
                      <span>Google Meet Redirect Link</span>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                    </a>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2.5 bg-zinc-955 hover:bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs transition-all cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => {
                        const inviteText = `Meeting Invitation:\nTitle: ${meeting.title}\nTime: ${new Date(meeting.start_time).toLocaleString()}\nLink: ${meeting.meet_link || ''}\nCode: ${getMeetingCode()}`;
                        navigator.clipboard.writeText(inviteText);
                        alert('Invitation copied to clipboard!');
                      }}
                      className="px-3 py-2.5 bg-zinc-955 hover:bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs transition-all cursor-pointer"
                      title="Copy Full Invitation Template"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Copy Invite</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Live Sim & Notes list (Original Center Column) */}
              <div className="space-y-6">
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 flex flex-col justify-between min-h-[260px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
                        <span>Live Simulator Roster</span>
                      </h3>
                      <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`}></span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Active in Call ({liveParticipants.length})</div>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {liveParticipants.length === 0 ? (
                          <div className="text-zinc-650 text-xs py-4 text-center">No participants inside call room.</div>
                        ) : (
                          liveParticipants.map(lp => (
                            <div key={lp.email} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-950/60 border border-zinc-900/80">
                              <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
                                {lp.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold truncate text-white">{lp.name}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-900 flex flex-col gap-2 mt-4">
                    <div className="text-[10px] uppercase font-bold text-zinc-550 tracking-wider">Simulation Controls</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={triggerJoinSimulation}
                        className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Join Guest</span>
                      </button>
                      <button
                        onClick={triggerLeaveSimulation}
                        disabled={liveParticipants.length <= 1}
                        className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800 disabled:opacity-50"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Leave Guest</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes Input & history list */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Notes & Comments Log</h3>
                  </div>

                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a meeting note..."
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none"
                    />
                    <button type="submit" className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {notes.length === 0 ? (
                      <div className="text-zinc-650 text-xs py-4 text-center">No notes written yet.</div>
                    ) : (
                      notes.map(n => (
                        <div key={n.id} className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900 text-xs text-zinc-350 leading-relaxed whitespace-pre-wrap">
                          {n.content}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {workspaceTab === 'transcript' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold">Search Transcript</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Real-time keyword lookup and speaker filters.</p>
                </div>
                <button
                  onClick={fetchTranscripts}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {/* Search inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Keyword search..."
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none"
                />
                <input
                  type="text"
                  placeholder="Speaker name filter..."
                  value={transcriptSpeakerFilter}
                  onChange={e => setTranscriptSpeakerFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none"
                />
              </div>

              {/* Transcript list */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2 pt-2">
                {transcriptsList.length === 0 ? (
                  <div className="text-zinc-650 text-xs py-16 text-center bg-zinc-950/20 rounded-3xl border border-zinc-900 border-dashed">
                    No matching transcript segments found. Run the audio processor first!
                  </div>
                ) : (
                  transcriptsList.map(item => (
                    <div key={item.id} className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-900 flex gap-3.5 items-start text-xs hover:border-zinc-800 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-zinc-400 uppercase flex-shrink-0 select-none">
                        {item.speaker.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center text-[10px] text-zinc-550 font-bold mb-1">
                          <span className="text-indigo-400">{item.speaker}</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {workspaceTab === 'summary' && (
            <div className="space-y-6">
              {/* Process audio helper card if no summary yet */}
              {!summary && (
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 text-center space-y-4">
                  <p className="text-zinc-400 text-xs">No summary generated. Go to AI Settings or details to upload a call recording.</p>
                </div>
              )}

              {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Detailed summary */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-3">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        <FileText className="w-4.5 h-4.5 text-indigo-400" />
                        <span>AI Executive Summary</span>
                      </h3>
                      <p className="text-xs text-zinc-350 leading-relaxed whitespace-pre-wrap">
                        {summary.summary_text}
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-3">
                      <h3 className="text-sm font-bold text-white">Key Decisions Made</h3>
                      <ul className="list-disc pl-5 text-xs text-zinc-400 space-y-2">
                        {summary.key_decisions?.map((dec: string, idx: number) => (
                          <li key={idx} className="leading-relaxed">{dec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Follow-up email draft */}
                  <div className="md:col-span-1">
                    <div className="p-5 rounded-3xl bg-zinc-900/30 border border-zinc-900 flex flex-col justify-between min-h-[300px] space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Follow-up Email Draft</h4>
                        <p className="text-[10px] text-zinc-500 mt-1">Generated template for attendees.</p>
                      </div>

                      {/* Mock/Render Follow-up draft */}
                      <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-850 text-[10px] font-mono text-zinc-400 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                        {`Subject: Follow-up: ${meeting.title}\n\nHello Team,\n\nThank you for today's call.\n\nSummary:\n${summary.summary_text}\n\nAction items and decisions are logged.`}
                      </div>

                      <button
                        onClick={() => {
                          const bodyText = `Subject: Follow-up: ${meeting.title}\n\nSummary:\n${summary.summary_text}`;
                          navigator.clipboard.writeText(bodyText);
                          alert('Email draft copied!');
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Copy Email Draft
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {workspaceTab === 'action-items' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Action Items Checklist</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Toggle status checklist. Syncs directly with SQL.</p>
                </div>
                <button
                  onClick={fetchActionItems}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {/* Roster of items */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {actionItemsList.length === 0 ? (
                  <div className="text-zinc-650 text-xs py-16 text-center bg-zinc-950/20 rounded-3xl border border-zinc-900 border-dashed">
                    No action items generated yet. Run AI process audio recording first!
                  </div>
                ) : (
                  actionItemsList.map(item => {
                    const isDone = item.status?.toLowerCase() === 'completed';
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl bg-zinc-950/50 border flex items-center justify-between gap-4 text-xs transition-all hover:border-zinc-800 ${
                          isDone ? 'border-indigo-600/20 opacity-70 bg-indigo-500/[0.01]' : 'border-zinc-900'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleUpdateActionItem(item.id, isDone ? 'Pending' : 'Completed')}
                            className="mt-0.5 w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className={`font-semibold text-zinc-200 truncate ${isDone ? 'line-through text-zinc-500' : ''}`}>{item.task}</p>
                            <div className="flex gap-2 text-[10px] text-zinc-500 font-bold mt-1 uppercase">
                              <span>Owner: {item.owner}</span>
                              <span>•</span>
                              <span>Priority: {item.priority}</span>
                            </div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isDone 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {workspaceTab === 'insights' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold">Meeting Insights & Analytics</h3>
                  <p className="text-zinc-550 text-xs mt-0.5">Participation indices and conversational breakdown statistics.</p>
                </div>
                <button
                  onClick={fetchInsights}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl border border-zinc-800 cursor-pointer"
                >
                  Refresh Insights
                </button>
              </div>

              {insightsData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Score & Interruptions */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 text-center space-y-2">
                      <div className="text-[10px] uppercase font-bold text-zinc-500">Participation Index</div>
                      <div className="text-4xl font-extrabold text-indigo-400">{insightsData.participation_score || 0}%</div>
                      <p className="text-[10px] text-zinc-550">Overall guest collaboration level.</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 text-center space-y-1">
                      <div className="text-[10px] uppercase font-bold text-zinc-500">Interruptions Counter</div>
                      <div className="text-2xl font-extrabold text-rose-400">{insightsData.interruptions || 0}</div>
                      <p className="text-[10px] text-zinc-550">Speech overlapping overlaps logged.</p>
                    </div>
                  </div>

                  {/* Speaking Times meters */}
                  <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-4 md:col-span-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-white">Speaking time distribution</div>
                    
                    <div className="space-y-3.5">
                      {Object.entries(insightsData.speaking_times || {}).map(([speaker, duration]: [string, any]) => {
                        const total = Object.values(insightsData.speaking_times).reduce((a: any, b: any) => a + b, 0) as number || 1;
                        const pct = Math.round((duration / total) * 100);
                        return (
                          <div key={speaker} className="space-y-1 text-xs">
                            <div className="flex justify-between font-semibold text-zinc-350">
                              <span>{speaker}</span>
                              <span>{pct}% ({Math.round(duration)}s)</span>
                            </div>
                            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-850">
                              <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Silent participants */}
                    {((insightsData.silent_participants) || []).length > 0 && (
                      <div className="pt-3 border-t border-zinc-900 text-xs">
                        <span className="font-bold text-zinc-500">Silent Members:</span>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {insightsData.silent_participants.map((email: string) => (
                            <span key={email} className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] text-zinc-400">
                              {email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-650 text-xs py-12 text-center bg-zinc-950/20 rounded-3xl border border-zinc-900 border-dashed">
                  Waiting for insight generation. Run speech analyzer first.
                </div>
              )}
            </div>
          )}

          {workspaceTab === 'recordings' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
              <div>
                <h3 className="text-lg font-bold">Audio Recordings List</h3>
                <p className="text-zinc-555 text-xs mt-0.5">Logs and download triggers for processed meeting room files.</p>
              </div>

              {/* Roster of recordings */}
              <div className="space-y-3">
                {notes.some(n => n.content.includes("FULL TRANSCRIPT")) ? (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <FileAudio className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-300">whisper_session_audio.mp3</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Duration: ~6 mins</p>
                      </div>
                    </div>

                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Your recording file path download has started.');
                      }}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl font-bold cursor-pointer"
                    >
                      Download MP3
                    </a>
                  </div>
                ) : (
                  <div className="text-zinc-650 text-xs py-16 text-center bg-zinc-950/20 rounded-3xl border border-zinc-900 border-dashed">
                    No call recordings processed for this meeting workspace.
                  </div>
                )}
              </div>
            </div>
          )}

          {workspaceTab === 'settings' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
              <div>
                <h3 className="text-lg font-bold">AI Assistant Preferences Settings</h3>
                <p className="text-zinc-555 text-xs mt-0.5">Configure GPT model types, language preferences, and file exports.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-zinc-900 pb-6 text-xs">
                {/* Summary style */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 font-bold uppercase text-[9px]">Summary Preset Style</label>
                  <select
                    value={aiSettingsData.summary_style}
                    onChange={e => handleUpdateAISettings({ summary_style: e.target.value })}
                    className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                  >
                    <option value="detailed">Detailed description report</option>
                    <option value="bullet">Bullet point summary</option>
                    <option value="executive">Executive summary overview</option>
                  </select>
                </div>

                {/* Model */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-500 font-bold uppercase text-[9px]">AI Intelligence Model</label>
                  <select
                    value={aiSettingsData.ai_model}
                    onChange={e => handleUpdateAISettings({ ai_model: e.target.value })}
                    className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (Highly performant, fast)</option>
                    <option value="gpt-4o">gpt-4o (High reasoning, accurate)</option>
                  </select>
                </div>

                {/* Checklist options */}
                <div className="space-y-3.5 md:col-span-2 pt-2 border-t border-zinc-900/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-350">Automated Summary Synthesis</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Generate notes immediately when session ends.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettingsData.auto_summary}
                      onChange={e => handleUpdateAISettings({ auto_summary: e.target.checked })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-350">Automated Email follow-up dispatch</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Email all workspace members summary briefs.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiSettingsData.auto_email}
                      onChange={e => handleUpdateAISettings({ auto_email: e.target.checked })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Data exports */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Export Meeting Analytics Workspace</h4>
                <p className="text-zinc-500 text-xs">Download full transcripts and summary reports directly to your filesystem.</p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => handleExportData('txt')}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl font-semibold text-xs cursor-pointer"
                  >
                    Export as Plain Text (.TXT)
                  </button>
                  <button
                    onClick={() => handleExportData('md')}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl font-semibold text-xs cursor-pointer"
                  >
                    Export as Markdown (.MD)
                  </button>
                  <button
                    onClick={() => handleExportData('json')}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl font-semibold text-xs cursor-pointer"
                  >
                    Export as raw JSON (.JSON)
                  </button>
                </div>
              </div>
            </div>
          )}

          {workspaceTab === 'automation' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Productivity Workflows & Integrations</h3>
                <p className="text-zinc-550 text-xs mt-0.5">Trigger immediate data sync and channel announcements for this meeting session.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { id: 'notion', label: 'Export to Notion Database', details: 'Creates a summary page with action items and decisions', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' },
                  { id: 'slack', label: 'Notify Slack Channel', details: 'Sends highlights reminder to configured channel #general', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' },
                  { id: 'jira', label: 'Create Jira Backlog Ticket', details: 'Converts items into Jira issues assigned to developer owner', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' },
                  { id: 'github', label: 'Create GitHub Issues', details: 'Generates repository issues linked to meeting transcript', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' },
                  { id: 'trello', label: 'Append Trello Board Cards', details: 'Appends checklist items to trello Kanban lists', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' },
                  { id: 'discord', label: 'Notify Discord Webhook', details: 'Sends server-wide notifications of completed meeting', color: 'from-zinc-900 to-zinc-950 hover:border-zinc-800' }
                ].map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleTriggerWorkflow(action.id)}
                    className={`p-5 rounded-2xl bg-gradient-to-br border border-zinc-900 text-left transition-all group cursor-pointer ${action.color}`}
                  >
                    <div className="font-bold text-xs text-white group-hover:text-indigo-400 transition-colors">{action.label}</div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{action.details}</p>
                    <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider mt-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                      <span>Trigger Now</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {showMobileDrawer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden flex items-end">
          <div className="fixed inset-0" onClick={() => setShowMobileDrawer(false)}></div>
          <div className="w-full bg-zinc-950 border-t border-zinc-850 rounded-t-3xl p-6 shadow-2xl relative z-50 animate-slide-up max-h-[85vh] flex flex-col">
            <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-4 flex-shrink-0"></div>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-bold">People Panel ({participants.length})</h3>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderPeoplePanel()}
            </div>
          </div>
        </div>
      )}

      {selectedProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-lg">
                {selectedProfile.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-base text-white truncate">{selectedProfile.display_name}</h4>
                <p className="text-xs text-zinc-500 truncate">{selectedProfile.email}</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-zinc-905 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Workspace Role:</span>
                <span className="font-semibold text-zinc-300 capitalize">{selectedProfile.organizer ? 'Organizer (Host)' : 'Guest'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Google Calendar RSVP:</span>
                <span className="font-semibold text-indigo-400 capitalize">{selectedProfile.response_status === 'needsAction' ? 'Pending' : selectedProfile.response_status}</span>
              </div>
              {selectedProfile.last_synced && (
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Last Synced:</span>
                  <span className="font-semibold text-zinc-350">{new Date(selectedProfile.last_synced).toLocaleString()}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedProfile(null)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showAddPeopleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Add People</span>
              </h3>
              <button
                onClick={() => setShowAddPeopleModal(false)}
                className="p-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-450 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Type an email address and press <kbd className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-550 border border-zinc-850 text-[10px]">Enter</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-555 border border-zinc-850 text-[10px]">Space</kbd>, or comma to add them to the invite list.
              </p>

              <div className="min-h-24 p-3 bg-zinc-950 border border-zinc-855 rounded-2xl flex flex-wrap gap-2 items-center align-top focus-within:border-indigo-500 transition-colors">
                {inviteChips.map((chip, idx) => (
                  <span
                    key={chip}
                    className="pl-3 pr-1.5 py-1 bg-zinc-900 border border-zinc-805 rounded-full text-xs font-semibold text-white flex items-center gap-1.5"
                  >
                    <span>{chip}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(idx)}
                      className="p-0.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={inviteChips.length === 0 ? "Enter email addresses..." : ""}
                  value={inviteEmailInput}
                  onChange={e => setInviteEmailInput(e.target.value)}
                  onKeyDown={handleAddChip}
                  className="flex-1 min-w-[140px] bg-transparent text-xs text-white border-none outline-none py-1"
                  disabled={emailActionLoading}
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold px-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-850">
              <button
                type="button"
                onClick={() => setShowAddPeopleModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                disabled={emailActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBulkInvites}
                disabled={emailActionLoading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {emailActionLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{emailActionLoading ? 'Sending Invites...' : 'Invite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
