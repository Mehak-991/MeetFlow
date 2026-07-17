'use strict';
'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getAuthToken } from '@/lib/api';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Settings,
  Volume2,
  Users,
  Video,
  Monitor,
  Info,
  Shield,
  Zap,
  Sparkles,
  X
} from 'lucide-react';

interface MeetingDetail {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  timezone: string;
  meet_link?: string;
  organizer_email: string;
  attendees: string[];
  status: string;
}

export default function JoinPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = use(params);
  const router = useRouter();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Device toggles
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [blurOn, setBlurOn] = useState(false);
  const [noiseFilterOn, setNoiseFilterOn] = useState(false);

  // Device listings
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load meeting details
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/');
      return;
    }

    const fetchDetails = async () => {
      try {
        const data = await apiRequest(`/api/meetings/${meetingId}`);
        setMeeting(data.meeting);
      } catch (err) {
        console.error('Failed to load meeting:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [meetingId, router]);

  // Request Camera & Microphone Stream
  const initLocalStream = async () => {
    // Clean up previous stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: camOn ? { deviceId: selectedVideo ? { exact: selectedVideo } : undefined } : false,
        audio: micOn ? { deviceId: selectedAudio ? { exact: selectedAudio } : undefined } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && camOn) {
        videoRef.current.srcObject = stream;
      }

      // Enumerate devices if not already done
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
    } catch (err) {
      console.warn('Failed to access video/audio inputs:', err);
    }
  };

  useEffect(() => {
    initLocalStream();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [camOn, micOn, selectedVideo, selectedAudio]);

  const toggleMic = () => {
    setMicOn(prev => !prev);
  };

  const toggleCam = () => {
    setCamOn(prev => !prev);
  };

  const handleJoinMeeting = () => {
    // Route to actual interactive workspace
    router.push(`/my-meetings/${meetingId}`);
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
      {/* Header bar */}
      <nav className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 flex items-center justify-between px-8 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-600/20">
            M
          </div>
          <span className="font-extrabold tracking-tight text-white text-lg">MeetFlow</span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-zinc-900"
        >
          <Settings className="w-5 h-5" />
        </button>
      </nav>

      {/* Join layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
        
        {/* Left Column: Camera Preview Box */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-video rounded-3xl bg-zinc-900 border border-zinc-800/80 overflow-hidden shadow-2xl flex items-center justify-center">
            {camOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-3xl transition-all duration-300 ${
                  blurOn ? 'blur-md scale-105' : ''
                }`}
              />
            ) : (
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center text-zinc-600 border border-zinc-800 mx-auto">
                  <VideoOff className="w-8 h-8" />
                </div>
                <div className="text-sm font-semibold text-zinc-555">The camera is turned off</div>
              </div>
            )}

            {/* Bottom floating toggles */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-zinc-950/80 backdrop-blur border border-zinc-800 z-10">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  micOn
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
                title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleCam}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  camOn
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
                title={camOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              
              <div className="w-px h-6 bg-zinc-800 mx-1"></div>

              {/* Blur toggle */}
              <button
                onClick={() => setBlurOn(prev => !prev)}
                className={`p-3 rounded-full transition-all cursor-pointer ${
                  blurOn ? 'bg-indigo-600 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400'
                }`}
                title="Toggle Background Blur"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Title, Guest status and Join Buttons */}
        <div className="lg:col-span-2 space-y-8 flex flex-col justify-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
              Ready to join?
            </h1>
            <div>
              <h2 className="text-lg font-bold text-indigo-400">{meeting.title}</h2>
              {meeting.description && (
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">{meeting.description}</p>
              )}
            </div>
          </div>

          {/* Invited guests count */}
          <div className="flex items-center gap-3 p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-zinc-400 border border-zinc-850">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-semibold">Attendees Invited</div>
              <div className="text-sm font-bold text-white">{meeting.attendees?.length || 0} guests</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleJoinMeeting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-base shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Join Now</span>
            </button>
            <button
              onClick={handleJoinMeeting}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-semibold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4.5 h-4.5" />
              <span>Present screen</span>
            </button>
          </div>
        </div>
      </main>

      {/* Device Settings popup overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Audio & Video Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-450 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Video Device Select */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-550 font-bold uppercase tracking-wider">Camera</label>
                <select
                  value={selectedVideo}
                  onChange={e => setSelectedVideo(e.target.value)}
                  className="w-full p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white"
                >
                  {videoDevices.length === 0 && <option value="">Default Camera</option>}
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                  ))}
                </select>
              </div>

              {/* Audio Device Select */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-550 font-bold uppercase tracking-wider">Microphone</label>
                <select
                  value={selectedAudio}
                  onChange={e => setSelectedAudio(e.target.value)}
                  className="w-full p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white"
                >
                  {audioDevices.length === 0 && <option value="">Default Microphone</option>}
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                  ))}
                </select>
              </div>

              {/* Additional toggles */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold">Noise Cancellation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={noiseFilterOn}
                    onChange={e => setNoiseFilterOn(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
