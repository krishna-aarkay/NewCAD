import React, { useState, useEffect } from 'react';
import { User, Bell, Settings, ShieldAlert, Key, Users, RefreshCw, Cpu, Search, Mail, Plus, Trash2, Send, Lock } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface ProfileSettingsProps {
  apiHost: string;
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
}

export default function ProfileSettings({ apiHost, currentUser, onChangeUser }: ProfileSettingsProps) {
  const [email, setEmail] = useState(currentUser.email);
  const [group, setGroup] = useState(currentUser.group || 'IC_DESIGN_LEAD');
  const [project, setProject] = useState(currentUser.project || 'Project_Apollo');
  const [host, setHost] = useState(currentUser.host || 'workstation-local');
  
  // Notification states
  const [emailAlerts, setEmailAlerts] = useState(currentUser.notifications.emailAlerts);
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState(currentUser.notifications.expiryDaysThreshold);
  const [checkoutAlerts, setCheckoutAlerts] = useState(currentUser.notifications.checkoutAlerts);
  const [preemptionAlerts, setPreemptionAlerts] = useState(currentUser.notifications.preemptionAlerts);

  // Users inventory list (Admin / Manager only)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // User Creation parameters
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newUserEmailInput, setNewUserEmailInput] = useState('');
  const [newUserRoleInput, setNewUserRoleInput] = useState<UserRole>('Engineer');
  const [newUserGroupInput, setNewUserGroupInput] = useState('IC_DESIGN_LEAD');
  const [newUserProjectInput, setNewUserProjectInput] = useState('Project_Apollo');
  const [newUserHostInput, setNewUserHostInput] = useState('workstation-local');
  const [addingUser, setAddingUser] = useState(false);

  // SMTP Configuration state variables
  const [smtpHost, setSmtpHost] = useState('smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('licensing@office365.corp');
  const [smtpSenderName, setSmtpSenderName] = useState('LicenseFlow Core Notifications');
  const [smtpSenderEmail, setSmtpSenderEmail] = useState('licensing@office365.corp');
  const [smtpRecipients, setSmtpRecipients] = useState('sowjanyanarava541@gmail.com');
  const [smtpTlsEnabled, setSmtpTlsEnabled] = useState(true);
  const [smtpAlertsEnabled, setSmtpAlertsEnabled] = useState(true);
  const [smtpTestStatus, setSmtpTestStatus] = useState<'idle' | 'success' | 'failure' | 'sending'>('idle');
  const [smtpTestLog, setSmtpTestLog] = useState('');
  const [loadingSmtp, setLoadingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  const filteredUsers = usersList.filter(usr => {
    const term = searchTerm.toLowerCase();
    const usernameMatch = (usr.username || '').toLowerCase().includes(term);
    const emailMatch = (usr.email || '').toLowerCase().includes(term);
    return usernameMatch || emailMatch;
  });

  useEffect(() => {
    if (currentUser.role !== 'Engineer') {
      fetchUsersList();
    }
    fetchSmtpSettings();
  }, [currentUser]);

  const fetchSmtpSettings = async () => {
    setLoadingSmtp(true);
    try {
      const res = await fetch(`${apiHost}/api/config/smtp`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      if (data.smtpSettings) {
        setSmtpHost(data.smtpSettings.host);
        setSmtpPort(data.smtpSettings.port);
        setSmtpUsername(data.smtpSettings.username);
        setSmtpSenderName(data.smtpSettings.senderName);
        setSmtpSenderEmail(data.smtpSettings.senderEmail);
        setSmtpRecipients(data.smtpSettings.recipients);
        setSmtpTlsEnabled(data.smtpSettings.tlsEnabled);
        setSmtpAlertsEnabled(data.smtpSettings.alertsEnabled);
        setSmtpTestStatus(data.smtpSettings.testStatus || 'idle');
        setSmtpTestLog(data.smtpSettings.testLog || '');
      }
    } catch (err) {
      console.error('Error fetching SMTP settings info:', err);
    } finally {
      setLoadingSmtp(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await fetch(`${apiHost}/api/config/smtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          username: smtpUsername,
          senderName: smtpSenderName,
          senderEmail: smtpSenderEmail,
          recipients: smtpRecipients,
          tlsEnabled: smtpTlsEnabled,
          alertsEnabled: smtpAlertsEnabled
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update SMTP configurations');

      alert('smtp.office365.com alerts parameters saved successfully!');
    } catch (err: any) {
      alert(`SMTP save fail: ${err.message}`);
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestStatus('sending');
    try {
      const res = await fetch(`${apiHost}/api/config/smtp/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed testing transport socket');

      setSmtpTestStatus('success');
      setSmtpTestLog(data.smtpSettings.testLog || '');
      alert('Office365 SMTP channel verification passed! Interactive pipeline log compiled below.');
    } catch (err: any) {
      setSmtpTestStatus('failure');
      setSmtpTestLog(`[ERROR-SMTP] Handshake interrupted: ${err.message}`);
      alert(`Test deliver error: ${err.message}`);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsernameInput || !newUserEmailInput) {
      alert('Username and profile Email are required.');
      return;
    }
    setAddingUser(true);
    try {
      const res = await fetch(`${apiHost}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          username: newUsernameInput,
          email: newUserEmailInput,
          role: newUserRoleInput,
          group: newUserGroupInput,
          project: newUserProjectInput,
          host: newUserHostInput
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to authorize custom user registration');

      alert(`Login user account '${newUsernameInput}' successfully registered in CAD inventory!`);
      setNewUsernameInput('');
      setNewUserEmailInput('');
      setNewUserRoleInput('Engineer');
      setShowAddUserForm(false);
      fetchUsersList();
    } catch (err: any) {
      alert(`Account registration error: ${err.message}`);
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely confident you want to revoke login rights and delete user profile '${name}'? This process cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${apiHost}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.username
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed revoking workspace registry');

      alert(`Login user credentials for '${name}' have been deleted.`);
      fetchUsersList();
    } catch (err: any) {
      alert(`Revoke block: ${err.message}`);
    }
  };

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${apiHost}/api/users`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err) {
      console.error('Error fetching system users list:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const res = await fetch(`${apiHost}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          email,
          group,
          project,
          host,
          notifications: {
            emailAlerts,
            expiryDaysThreshold: Number(expiryDaysThreshold),
            checkoutAlerts,
            preemptionAlerts
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      alert('Profile details and notification thresholds updated successfully!');
      onChangeUser(data.user);
    } catch (err: any) {
      alert(`Profile update block: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (currentUser.role !== 'Admin') {
      alert('Only administrators can change security governance roles.');
      return;
    }
    
    try {
      const res = await fetch(`${apiHost}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) throw new Error('Role update failed');
      
      alert('Engineer role and security permissions updated successfully!');
      fetchUsersList();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
      {/* Settings Form column */}
      <div className="space-y-6">
        <form onSubmit={handleUpdateProfile} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <User className="w-5 text-blue-500" />
            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">CAD Workstation profile parameters</h3>
              <p className="text-[11px] text-slate-500">Manage workstation nodes criteria, emails and projects contexts.</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">User Handle / Web ID</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.username}
                  className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 font-bold text-indigo-500">Global System Role</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.role}
                  className="w-full px-3 py-1.5 bg-indigo-50 border border-indigo-100 font-semibold text-indigo-700 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">CAD Profile Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Design Team Group</label>
                <input
                  type="text"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Active Project</label>
                <input
                  type="text"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Workstation node</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Notifications settings */}
          <div className="pt-4 border-t border-slate-100 space-y-3.5">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Alert notification triggers</span>
            
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                Enable critical alerts email delivery
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkoutAlerts}
                  onChange={(e) => setCheckoutAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                Receive warnings on saturation checkouts
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={preemptionAlerts}
                  onChange={(e) => setPreemptionAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                Notify on early preemption occurrences
              </label>

              <div className="pt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                  <span>Licensing Keys Expiry Warning Threshold:</span>
                  <span className="font-semibold text-slate-700">{expiryDaysThreshold} Days prior</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={expiryDaysThreshold}
                  onChange={(e) => setExpiryDaysThreshold(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

        </form>

        {/* CAD Email alert server SMTP config */}
        {currentUser.role === 'Admin' && (
          <form onSubmit={handleSaveSmtp} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Mail className="w-5 text-indigo-500" />
              <div>
                <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">Office365 SMTP Alerts Server</h3>
                <p className="text-[11px] text-slate-500">Configure connection strings to smtp.office365.com for automated alerts tracking.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">SMTP Outgoing Host</label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    placeholder="smtp.office365.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    placeholder="587"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Account Login Username</label>
                <input
                  type="text"
                  required
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  placeholder="licensing@workplace-domain.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={smtpSenderName}
                    onChange={(e) => setSmtpSenderName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    placeholder="EDAFlow Core Administrator"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Sender Email</label>
                  <input
                    type="email"
                    value={smtpSenderEmail}
                    onChange={(e) => setSmtpSenderEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    placeholder="licensing@workplace-domain.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Primary Warning Recipients (comma separated)</label>
                <input
                  type="text"
                  required
                  value={smtpRecipients}
                  onChange={(e) => setSmtpRecipients(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono text-indigo-700"
                  placeholder="cadadmin@office365.corp, sowjanyanarava541@gmail.com"
                />
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpTlsEnabled}
                    onChange={(e) => setSmtpTlsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                  />
                  Require SSL/TLS Tunnel
                </label>
                
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpAlertsEnabled}
                    onChange={(e) => setSmtpAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                  />
                  Live SMTP Alerts Active
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingSmtp || testingSmtp}
                  className="py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-55"
                >
                  {savingSmtp ? 'Saving config...' : 'Save Settings'}
                </button>

                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={savingSmtp || testingSmtp}
                  className="py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1"
                >
                  <Send className="w-3 h-3 text-indigo-600" /> {testingSmtp ? 'Sending packet...' : 'Test alerts Email'}
                </button>
              </div>
            </div>

            {smtpTestLog && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  <span>SMTP Connection log outputs</span>
                  <span className={`px-1.5 py-0.5 rounded uppercase font-sans text-[8px] ${
                    smtpTestStatus === 'success' ? 'bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold' :
                    smtpTestStatus === 'failure' ? 'bg-rose-50 border border-rose-250 text-rose-700 font-bold' :
                    'bg-slate-150 text-slate-600'
                  }`}>{smtpTestStatus}</span>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={smtpTestLog}
                  className="w-full p-2 bg-slate-950 text-slate-300 font-mono text-[10px] rounded-lg focus:outline-none scrollbar-thin resize-none leading-relaxed"
                />
              </div>
            )}
          </form>
        )}
      </div>

      {/* Users and Roles controller list */}
      {currentUser.role !== 'Engineer' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-5 text-indigo-500" /> Security governance roles & profiles directory
              </h3>
              
              <div className="flex gap-1.5 self-end sm:self-auto">
                {currentUser.role === 'Admin' && (
                  <button
                    onClick={() => setShowAddUserForm(!showAddUserForm)}
                    className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add User
                  </button>
                )}
                
                <button
                  onClick={fetchUsersList}
                  disabled={loadingUsers}
                  className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-xs rounded-lg flex items-center gap-0.5 cursor-pointer transition"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} /> Sync
                </button>
              </div>
            </div>

            {/* Custom Create App User form (Admin Only) */}
            {showAddUserForm && currentUser.role === 'Admin' && (
              <form onSubmit={handleCreateUser} className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3 text-xs">
                <h4 className="font-semibold text-indigo-900 uppercase font-display text-[11px] tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" /> Register login permissions account
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">Username ID (Handshake)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. david_w"
                      value={newUsernameInput}
                      onChange={(e) => setNewUsernameInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. david@office365.corp"
                      value={newUserEmailInput}
                      onChange={(e) => setNewUserEmailInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">Governance Role</label>
                    <select
                      value={newUserRoleInput}
                      onChange={(e) => setNewUserRoleInput(e.target.value as UserRole)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    >
                      <option value="Engineer">Engineer</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">CAD Group</label>
                    <input
                      type="text"
                      placeholder="IC_DESIGN"
                      value={newUserGroupInput}
                      onChange={(e) => setNewUserGroupInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">Project Code</label>
                    <input
                      type="text"
                      placeholder="Project_Apollo"
                      value={newUserProjectInput}
                      onChange={(e) => setNewUserProjectInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-1">Client Workstation Host</label>
                    <input
                      type="text"
                      placeholder="cad-workstation-local"
                      value={newUserHostInput}
                      onChange={(e) => setNewUserHostInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingUser}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    {addingUser ? 'Creating profile...' : 'Register User'}
                  </button>
                </div>
              </form>
            )}

            {/* Premium real-time search lookup bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              />
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 text-center text-slate-400 rounded-lg text-xs font-medium">
                  {usersList.length === 0 
                    ? "No user profiles found in directory database registry."
                    : `No users matched "${searchTerm}"`}
                </div>
              ) : (
                filteredUsers.map((usr) => (
                  <div key={usr.id} className="p-3.5 bg-slate-50 border border-slate-150 rounded-lg flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5 text-left">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-slate-800">{usr.username}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({usr.email})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono font-bold">
                        Group: {usr.group || 'IC_DESIGN'} | Node: {usr.host || 'local'} | Project: {usr.project || 'Apollo'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentUser.role === 'Admin' && usr.username !== currentUser.username ? (
                        <>
                          <select
                            value={usr.role}
                            onChange={(e) => handleChangeRole(usr.id, e.target.value as UserRole)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-[11px]"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Engineer">Engineer</option>
                          </select>
                          
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(usr.id, usr.username)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Delete app login user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold rounded text-[10px]">
                          {usr.role.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-105 rounded-lg flex items-start gap-2 text-xs text-blue-700 leading-relaxed mt-4">
            <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>Governance roles constraints:</strong> Administrators maintain complete read/write variables, custom flexlm daemons operations, options rule builders compilations, and overrides permissions. Managers can authorize borrow applications. Engineers have sandbox simulation allocations.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
