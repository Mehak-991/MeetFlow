'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Users, Video, Calendar, Shield, Activity, FileText, 
  Settings, UserCheck, Bell, Download, Trash2, ShieldAlert, Plus, 
  X, Check, AlertCircle, RefreshCw, BarChart2 
} from 'lucide-react';

interface UserDirectoryItem {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  department: string | null;
  last_active_at: string | null;
}

interface AuditLogItem {
  id: string;
  user_email: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  browser: string | null;
  target_resource: string | null;
  timestamp: string;
}

interface OrgBranding {
  id: string;
  name: string;
  logo_url: string | null;
  domain: string | null;
  timezone: string;
  meeting_defaults: any;
  custom_colors: any;
}

interface NotificationAlert {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'audit' | 'branding' | 'integrations'>('overview');

  // Stats states
  const [stats, setStats] = useState<any>({
    total_users: 0,
    active_users: 0,
    meetings_today: 0,
    meetings_month: 0,
    completed_meetings: 0,
    cancelled_meetings: 0,
    upcoming_meetings: 0,
    avg_meeting_duration: 0,
    avg_participants: 0,
    ai_summary_usage: 0,
    recording_usage: 0,
    storage_usage_mb: 0
  });

  // User directory states
  const [usersList, setUsersList] = useState<UserDirectoryItem[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Analytics states
  const [analytics, setAnalytics] = useState<any>({
    meetings_per_day: [],
    peak_usage: {},
    top_hosts: [],
    user_growth: []
  });

  // Audit logs states
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditQuery, setAuditQuery] = useState('');

  // Branding preferences states
  const [branding, setBranding] = useState<OrgBranding>({
    id: '',
    name: 'MeetFlow Enterprise',
    logo_url: 'https://meetflow.app/logo.png',
    domain: '',
    timezone: 'UTC',
    meeting_defaults: {},
    custom_colors: { primary: '#4f46e5', secondary: '#818cf8' }
  });
  const [brandingNameInput, setBrandingNameInput] = useState('MeetFlow Enterprise');
  const [brandingLogoInput, setBrandingLogoInput] = useState('');
  const [brandingTimezoneInput, setBrandingTimezoneInput] = useState('UTC');
  const [brandingColorsInput, setBrandingColorsInput] = useState({ primary: '#4f46e5', secondary: '#818cf8' });

  // Notifications states
  const [notifications, setNotifications] = useState<NotificationAlert[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // API helper request
  const apiRequest = async (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        alert('Access denied. Admin privileges required.');
        router.push('/my-meetings');
      }
      throw new Error(`API Request failure: ${response.statusText}`);
    }
    return response.json();
  };

  // Fetch helpers
  const fetchDashboardWidgets = async () => {
    try {
      const data = await apiRequest('/api/admin/widgets');
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const statusParam = userStatusFilter === 'active' ? 'true' : userStatusFilter === 'inactive' ? 'false' : '';
      const url = `/api/admin/users?role=${userRoleFilter}&is_active=${statusParam}&query=${encodeURIComponent(userSearchQuery)}`;
      const data = await apiRequest(url);
      setUsersList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await apiRequest('/api/admin/analytics');
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiRequest(`/api/admin/audit-logs?query=${encodeURIComponent(auditQuery)}`);
      setAuditLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBranding = async () => {
    try {
      const data = await apiRequest('/api/admin/organization');
      setBranding(data);
      setBrandingNameInput(data.name);
      setBrandingLogoInput(data.logo_url || '');
      setBrandingTimezoneInput(data.timezone);
      setBrandingColorsInput(data.custom_colors || { primary: '#4f46e5', secondary: '#818cf8' });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest('/api/admin/notifications');
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Integrations & Webhooks states
  const [integrationsList, setIntegrationsList] = useState<any>({
    slack_webhook: '',
    discord_webhook: '',
    notion_token: '',
    notion_database_id: '',
    jira_url: '',
    jira_token: '',
    jira_project: '',
    trello_token: '',
    trello_board_id: '',
    github_token: '',
    github_repo: '',
    enabled_integrations: {}
  });

  const [webhooksList, setWebhooksList] = useState<any[]>([]);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookEventsInput, setWebhookEventsInput] = useState<string[]>(['meeting.created', 'ai.summary.ready']);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  const [apiKeysList, setApiKeysList] = useState<any[]>([]);
  const [generatedRawKey, setGeneratedRawKey] = useState('');

  const fetchIntegrations = async () => {
    try {
      const data = await apiRequest('/api/integrations/settings');
      setIntegrationsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const data = await apiRequest('/api/integrations/webhooks');
      setWebhooksList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWebhookLogs = async () => {
    try {
      const data = await apiRequest('/api/integrations/webhooks/logs');
      setWebhookLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const data = await apiRequest('/api/integrations/api-keys');
      setApiKeysList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateIntegrations = async (updatedFields: any) => {
    try {
      await apiRequest('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      });
      setIntegrationsList((prev: any) => ({ ...prev, ...updatedFields }));
      alert('Integrations settings updated successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrlInput) return;
    try {
      await apiRequest('/api/integrations/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url: webhookUrlInput, events: webhookEventsInput })
      });
      setWebhookUrlInput('');
      fetchWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await apiRequest(`/api/integrations/webhooks/${webhookId}`, { method: 'DELETE' });
      fetchWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryWebhook = async (logId: string) => {
    try {
      const resp = await apiRequest(`/api/integrations/webhooks/logs/${logId}/retry`, { method: 'POST' });
      alert(`Webhook redelivered. Status code: ${resp.status_code}`);
      fetchWebhookLogs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const data = await apiRequest('/api/integrations/api-keys', { method: 'POST' });
      setGeneratedRawKey(data.token);
      fetchApiKeys();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      await apiRequest(`/api/integrations/api-keys/${keyId}`, { method: 'DELETE' });
      fetchApiKeys();
    } catch (e) {
      console.error(e);
    }
  };

  // Lazy tab loaded triggers
  useEffect(() => {
    fetchNotifications();
    fetchDashboardWidgets();
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'branding') {
      fetchBranding();
    } else if (activeTab === 'integrations') {
      fetchIntegrations();
      fetchWebhooks();
      fetchWebhookLogs();
      fetchApiKeys();
    }
  }, [activeTab, userRoleFilter, userStatusFilter, userSearchQuery, auditQuery]);

  // Actions
  const handleInviteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await apiRequest('/api/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      alert('Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteEmail('');
      fetchUsers();
    } catch (e) {
      console.error(e);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId: number) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/status`, { method: 'PUT' });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to permanently delete this user account?')) return;
    try {
      await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeRole = async (userId: number, role: string) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/organization', {
        method: 'PUT',
        body: JSON.stringify({
          name: brandingNameInput,
          logo_url: brandingLogoInput,
          timezone: brandingTimezoneInput,
          custom_colors: brandingColorsInput
        })
      });
      alert('Branding preferences saved successfully!');
      fetchBranding();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = (reportType: string) => {
    const token = localStorage.getItem('token');
    window.open(`/api/admin/reports/export?report_type=${reportType}&token=${token}`, '_blank');
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await apiRequest('/api/admin/notifications/read', { method: 'POST' });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const getUnreadNotificationsCount = () => {
    return notifications.filter(n => !n.is_read).length;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      {/* Header bar */}
      <nav className="border-b border-zinc-900 bg-zinc-950/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/my-meetings')}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors border border-zinc-850/40 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                Enterprise Admin Center
              </h1>
              <p className="text-[10px] text-zinc-550 mt-1 uppercase font-bold tracking-wider">
                {branding.name} • Workspace Administration Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell widget */}
            <button
              onClick={() => {
                setShowNotificationsModal(true);
                handleMarkNotificationsRead();
              }}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-850/40 relative cursor-pointer"
              title="System Alerts"
            >
              <Bell className="w-5 h-5" />
              {getUnreadNotificationsCount() > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[8px] font-bold flex items-center justify-center text-white animate-bounce">
                  {getUnreadNotificationsCount()}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main console layout */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 flex-grow">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2 flex flex-col">
          {[
            { id: 'overview', label: 'Console Overview', icon: Shield },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'analytics', label: 'Analytics & Trends', icon: Activity },
            { id: 'audit', label: 'Audit Trail Logs', icon: FileText },
            { id: 'branding', label: 'Branding & Setup', icon: Settings },
            { id: 'integrations', label: 'Integrations & Webhooks', icon: BarChart2 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full text-left px-4 py-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                  : 'bg-zinc-900/30 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Panel Content area */}
        <div className="lg:col-span-3 space-y-6">
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Members', value: stats.total_users, icon: Users, color: 'text-indigo-400' },
                  { label: 'Active Users', value: stats.active_users, icon: UserCheck, color: 'text-emerald-400' },
                  { label: 'Meetings Today', value: stats.meetings_today, icon: Calendar, color: 'text-purple-400' },
                  { label: 'Meetings Month', value: stats.meetings_month, icon: Video, color: 'text-amber-400' }
                ].map((s, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-900 space-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                      <s.icon className="w-16 h-16" />
                    </div>
                    <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">{s.label}</span>
                    <h3 className={`text-2xl font-extrabold ${s.color}`}>{s.value}</h3>
                  </div>
                ))}
              </div>

              {/* Extra metric widgets grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Meeting performance metrics */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Meeting Quality Logs</h4>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-900/50">
                      <span className="text-zinc-500">Average Duration:</span>
                      <span className="font-semibold text-zinc-350">{stats.avg_meeting_duration} mins</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/50">
                      <span className="text-zinc-500">Average Guests:</span>
                      <span className="font-semibold text-zinc-350">{stats.avg_participants} per call</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Meeting Status:</span>
                      <span className="font-semibold text-zinc-350">
                        {stats.completed_meetings} Done / {stats.cancelled_meetings} Cancel
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI capabilities usage overview */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">AI Modules analytics</h4>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-900/50">
                      <span className="text-zinc-500">Otter Summaries Gen:</span>
                      <span className="font-semibold text-zinc-350">{stats.ai_summary_usage} reports</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-900/50">
                      <span className="text-zinc-500">Speech Recordings:</span>
                      <span className="font-semibold text-zinc-350">{stats.recording_usage} calls</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-500">Disk Storage Used:</span>
                      <span className="font-semibold text-indigo-400">{stats.storage_usage_mb} MB</span>
                    </div>
                  </div>
                </div>

                {/* Quick reports download list */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Export Admin Reports</h4>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleExportCSV('meetings')}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-xl text-left text-xs text-zinc-300 font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>Meetings Analysis</span>
                      <Download className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <button
                      onClick={() => handleExportCSV('attendance')}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-xl text-left text-xs text-zinc-300 font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>Attendance & RSVP</span>
                      <Download className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <button
                      onClick={() => handleExportCSV('audit')}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-xl text-left text-xs text-zinc-300 font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>System Audit Trail</span>
                      <Download className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold">User Directory</h3>
                  <p className="text-zinc-550 text-xs mt-0.5">Manage employee roles, access states, and system authorizations.</p>
                </div>
                
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Invite Member</span>
                </button>
              </div>

              {/* Directory Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none"
                />

                <select
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Organization Admin">Organization Admin</option>
                  <option value="Moderator">Moderator</option>
                  <option value="Host">Host</option>
                  <option value="Member">Member</option>
                  <option value="Guest">Guest</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={e => setUserStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Members</option>
                  <option value="inactive">Deactivated</option>
                </select>
              </div>

              {/* Directory directory table */}
              <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-550 uppercase font-bold text-[9px] tracking-wider bg-zinc-900/10">
                      <th className="p-4">Name / Email</th>
                      <th className="p-4">RBAC Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Directory Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-600 font-semibold">
                          No users matched directories query filter criteria.
                        </td>
                      </tr>
                    ) : (
                      usersList.map(u => (
                        <tr key={u.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-white">{u.name || 'Sign-up Pending'}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">{u.email}</div>
                          </td>
                          <td className="p-4">
                            <select
                              value={u.role}
                              onChange={e => handleChangeRole(u.id, e.target.value)}
                              className="px-2 py-1 bg-zinc-950 border border-zinc-850 rounded-lg text-[10px] text-zinc-300 font-bold outline-none cursor-pointer"
                            >
                              <option value="Super Admin">Super Admin</option>
                              <option value="Organization Admin">Org Admin</option>
                              <option value="Moderator">Moderator</option>
                              <option value="Host">Host</option>
                              <option value="Member">Member</option>
                              <option value="Guest">Guest</option>
                            </select>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              u.is_active 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {u.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] cursor-pointer ${
                                u.is_active
                                  ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500'
                              }`}
                            >
                              {u.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 rounded bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 cursor-pointer"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Analytics & Usage Trends</h3>
                <p className="text-zinc-550 text-xs mt-0.5">Summary tracking graphs for organizations call operations.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Meetings per day chart list */}
                <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Daily Meetings Load</h4>
                  <div className="space-y-3.5">
                    {analytics.meetings_per_day?.map((day: any) => (
                      <div key={day.date} className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-zinc-500">{day.date}</span>
                        <div className="flex-1 mx-4 bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(day.count * 15, 100)}%` }}></div>
                        </div>
                        <span className="text-white w-5 text-right">{day.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top organizer hosts bars list */}
                <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Top Roster Hosts</h4>
                  <div className="space-y-3.5">
                    {analytics.top_hosts?.map((host: any) => (
                      <div key={host.email} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span className="text-zinc-350 truncate max-w-[150px]">{host.email}</span>
                          <span className="text-white">{host.count} calls</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(host.count * 10, 100)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold">System Audit Trail</h3>
                  <p className="text-zinc-550 text-xs mt-0.5">Regulatory activity logs tracking logins, deletions, and updates.</p>
                </div>
                
                <input
                  type="text"
                  placeholder="Filter by keyword..."
                  value={auditQuery}
                  onChange={e => setAuditQuery(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white outline-none w-48"
                />
              </div>

              {/* Audit trail table */}
              <div className="overflow-x-auto border border-zinc-900 rounded-2xl bg-zinc-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-zinc-550 uppercase font-bold text-[9px] tracking-wider bg-zinc-900/10">
                      <th className="p-4">Time</th>
                      <th className="p-4">Admin Email</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Details</th>
                      <th className="p-4">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60 font-mono text-[10px]">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-650 font-sans text-xs">
                          No audit event logs recorded.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map(l => (
                        <tr key={l.id} className="hover:bg-zinc-900/10">
                          <td className="p-4 text-zinc-500 whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                          <td className="p-4 text-indigo-400 font-sans font-semibold">{l.user_email}</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-850 rounded text-[9px] font-bold text-zinc-350">
                              {l.action}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-300 font-sans">{l.details}</td>
                          <td className="p-4 text-zinc-500 whitespace-nowrap font-sans text-[9px]">
                            <div>IP: {l.ip_address}</div>
                            <div className="truncate max-w-[100px]" title={l.browser || ''}>Agent: {l.browser}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-6">
              <div>
                <h3 className="text-lg font-bold">Enterprise Preferences & Branding</h3>
                <p className="text-zinc-550 text-xs mt-0.5">Customize workspace labels, custom color presets, and regional details.</p>
              </div>

              <form onSubmit={handleUpdateBranding} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-500 font-bold uppercase text-[9px]">Company Workspace Name</label>
                    <input
                      type="text"
                      value={brandingNameInput}
                      onChange={e => setBrandingNameInput(e.target.value)}
                      className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-500 font-bold uppercase text-[9px]">Logo URL Asset</label>
                    <input
                      type="text"
                      value={brandingLogoInput}
                      onChange={e => setBrandingLogoInput(e.target.value)}
                      className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-500 font-bold uppercase text-[9px]">Timezone Offset</label>
                    <select
                      value={brandingTimezoneInput}
                      onChange={e => setBrandingTimezoneInput(e.target.value)}
                      className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                    >
                      <option value="UTC">UTC (Universal Coordinated)</option>
                      <option value="America/New_York">EST (Eastern Standard)</option>
                      <option value="Asia/Kolkata">IST (Indian Standard)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-zinc-900">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    Save enterprise settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* API Keys Panel */}
              <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      <span>REST API Access Keys</span>
                    </h3>
                    <p className="text-zinc-550 text-xs mt-0.5">Generate API tokens for public webhook dispatch tools.</p>
                  </div>
                  <button
                    onClick={handleCreateApiKey}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                  >
                    Generate Key
                  </button>
                </div>

                {generatedRawKey && (
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2 animate-fade-in">
                    <div className="text-xs font-bold text-indigo-400">Copy your API Key:</div>
                    <p className="text-xs text-white font-mono select-all bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 truncate">
                      {generatedRawKey}
                    </p>
                    <div className="text-[9px] text-zinc-500 font-semibold leading-none">
                      Warning: Store this token securely. It will not be shown again.
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {apiKeysList.length === 0 ? (
                    <div className="text-zinc-650 text-xs py-4 text-center">No active API keys created yet.</div>
                  ) : (
                    apiKeysList.map(key => (
                      <div key={key.id} className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                          <div>
                            <span className="font-semibold text-zinc-300">{key.name}</span>
                            <div className="text-[10px] text-zinc-550 mt-0.5">Created: {new Date(key.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteApiKey(key.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-zinc-900 cursor-pointer"
                          title="Revoke Token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Integrations config grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Notion configuration */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Notion Workspace</h3>
                    <input
                      type="checkbox"
                      checked={!!integrationsList.enabled_integrations?.notion}
                      onChange={e => handleUpdateIntegrations({
                        enabled_integrations: {
                          ...integrationsList.enabled_integrations,
                          notion: e.target.checked
                        }
                      })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Integration Token</label>
                      <input
                        type="password"
                        placeholder="secret_..."
                        value={integrationsList.notion_token || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, notion_token: e.target.value })}
                        className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Database UUID ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 8f2b34..."
                        value={integrationsList.notion_database_id || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, notion_database_id: e.target.value })}
                        className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateIntegrations({
                        notion_token: integrationsList.notion_token,
                        notion_database_id: integrationsList.notion_database_id
                      })}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg font-bold border border-zinc-800 cursor-pointer"
                    >
                      Save Notion credentials
                    </button>
                  </div>
                </div>

                {/* Slack configuration */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Slack Reminders</h3>
                    <input
                      type="checkbox"
                      checked={!!integrationsList.enabled_integrations?.slack}
                      onChange={e => handleUpdateIntegrations({
                        enabled_integrations: {
                          ...integrationsList.enabled_integrations,
                          slack: e.target.checked
                        }
                      })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Incoming Webhook URL</label>
                      <input
                        type="text"
                        placeholder="https://hooks.slack.com/services/..."
                        value={integrationsList.slack_webhook || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, slack_webhook: e.target.value })}
                        className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateIntegrations({
                        slack_webhook: integrationsList.slack_webhook
                      })}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg font-bold border border-zinc-800 cursor-pointer"
                    >
                      Save Slack Webhook
                    </button>
                  </div>
                </div>

                {/* Jira configuration */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Jira Issues</h3>
                    <input
                      type="checkbox"
                      checked={!!integrationsList.enabled_integrations?.jira}
                      onChange={e => handleUpdateIntegrations({
                        enabled_integrations: {
                          ...integrationsList.enabled_integrations,
                          jira: e.target.checked
                        }
                      })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Jira Base URL</label>
                      <input
                        type="text"
                        placeholder="https://company.atlassian.net"
                        value={integrationsList.jira_url || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, jira_url: e.target.value })}
                        className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Project Code Identifier</label>
                      <input
                        type="text"
                        placeholder="e.g. ENG"
                        value={integrationsList.jira_project || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, jira_project: e.target.value })}
                        className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateIntegrations({
                        jira_url: integrationsList.jira_url,
                        jira_project: integrationsList.jira_project
                      })}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-855 text-white rounded-lg font-bold border border-zinc-800 cursor-pointer"
                    >
                      Save Jira Setup
                    </button>
                  </div>
                </div>

                {/* GitHub configuration */}
                <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">GitHub Automation</h3>
                    <input
                      type="checkbox"
                      checked={!!integrationsList.enabled_integrations?.github}
                      onChange={e => handleUpdateIntegrations({
                        enabled_integrations: {
                          ...integrationsList.enabled_integrations,
                          github: e.target.checked
                        }
                      })}
                      className="w-4.5 h-4.5 text-indigo-600 bg-zinc-950 border-zinc-850 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="space-y-3.5 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase">Repository (owner/repo)</label>
                      <input
                        type="text"
                        placeholder="e.g. facebook/react"
                        value={integrationsList.github_repo || ''}
                        onChange={e => setIntegrationsList({ ...integrationsList, github_repo: e.target.value })}
                        className="p-2.5 bg-zinc-955 border border-zinc-850 rounded-xl text-white outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateIntegrations({
                        github_repo: integrationsList.github_repo
                      })}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-855 text-white rounded-lg font-bold border border-zinc-800 cursor-pointer"
                    >
                      Save GitHub Repository
                    </button>
                  </div>
                </div>

              </div>

              {/* Webhooks configuration and subscriptions */}
              <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-900 space-y-5">
                <div>
                  <h3 className="text-base font-bold">Webhook Event Destinations</h3>
                  <p className="text-zinc-550 text-xs mt-0.5">Subscribe external servers to real-time meeting events logs.</p>
                </div>

                <form onSubmit={handleCreateWebhook} className="flex gap-2 text-xs">
                  <input
                    type="url"
                    required
                    placeholder="https://your-server.com/webhooks"
                    value={webhookUrlInput}
                    onChange={e => setWebhookUrlInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-850 rounded-xl text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                  >
                    Subscribe URL
                  </button>
                </form>

                {/* Subscriptions list */}
                <div className="space-y-2">
                  {webhooksList.length === 0 ? (
                    <div className="text-zinc-650 text-xs py-4 text-center">No active webhook endpoints configured.</div>
                  ) : (
                    webhooksList.map(hook => (
                      <div key={hook.id} className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <span className="font-mono text-zinc-300 truncate block max-w-[280px]">{hook.url}</span>
                          <span className="text-[9px] text-zinc-550 font-semibold uppercase tracking-wider block mt-1">
                            Events: {hook.events?.join(', ')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteWebhook(hook.id)}
                          className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-zinc-900 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Webhook logs table */}
                <div className="space-y-3.5 pt-4 border-t border-zinc-900">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Delivery Log events</h4>
                  
                  <div className="overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/40 text-[10px]">
                    <table className="w-full text-left font-mono">
                      <thead>
                        <tr className="border-b border-zinc-900 text-zinc-550 uppercase font-bold text-[8px] bg-zinc-900/10">
                          <th className="p-3">Time</th>
                          <th className="p-3">Event</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Response Text</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40">
                        {webhookLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-zinc-650 font-sans text-xs">
                              No webhook deliveries logged yet.
                            </td>
                          </tr>
                        ) : (
                          webhookLogs.map(log => (
                            <tr key={log.id} className="hover:bg-zinc-900/10">
                              <td className="p-3 text-zinc-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                              <td className="p-3 text-indigo-400 font-sans font-semibold">{log.event}</td>
                              <td className="p-3">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  log.status_code === 200 
                                    ? 'bg-emerald-500/10 text-emerald-400' 
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {log.status_code}
                                </span>
                              </td>
                              <td className="p-3 text-zinc-400 font-sans truncate max-w-[150px]" title={log.response_text || ''}>
                                {log.response_text}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleRetryWebhook(log.id)}
                                  className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded font-semibold text-[8px] text-zinc-350 cursor-pointer"
                                >
                                  Retry
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Notifications Alert Modal */}
      {showNotificationsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-md font-bold flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <span>System Notifications Alerts</span>
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer border border-zinc-850"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {notifications.map(n => (
                <div key={n.id} className="p-3 rounded-2xl bg-zinc-955 border border-zinc-900 text-xs">
                  <div className="font-bold text-white mb-0.5">{n.title}</div>
                  <p className="text-zinc-400 leading-relaxed">{n.message}</p>
                  <span className="text-[8px] text-zinc-550 mt-1 block font-mono">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Drawer Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleInviteUserSubmit} className="w-full max-w-sm bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Invite Organization User</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-450 border border-zinc-850 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Member Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="p-3 bg-zinc-955 border border-zinc-850 rounded-xl text-white outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Enterprise RBAC Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="p-3 bg-zinc-955 border border-zinc-850 rounded-xl text-white outline-none cursor-pointer"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Organization Admin">Organization Admin</option>
                  <option value="Moderator">Moderator (Host assistant)</option>
                  <option value="Host">Host (Meeting organizer)</option>
                  <option value="Member">Member (Corporate directory)</option>
                  <option value="Guest">Guest (External domains)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 rounded-xl text-xs font-semibold cursor-pointer"
                disabled={inviteLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                {inviteLoading ? 'Sending invite...' : 'Send invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
