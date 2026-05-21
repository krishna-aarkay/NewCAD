import React, { useState, useEffect } from 'react';
import { User, Bell, Settings, ShieldAlert, Key, Users, RefreshCw, Cpu, Search } from 'lucide-react';
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
  }, [currentUser]);

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

          <button
            type="submit"
            disabled={updating}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-50 mt-4"
          >
            {updating ? 'Saving profiles...' : 'Update Settings Profiles'}
          </button>
        </form>
      </div>

      {/* Users and Roles controller list */}
      {currentUser.role !== 'Engineer' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-5 text-indigo-500" /> Security governance roles & profiles directory
              </h3>
              <button
                onClick={fetchUsersList}
                disabled={loadingUsers}
                className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} /> Sync Profiles
              </button>
            </div>

            {/* Premium real-time search lookup bar */}
            <div className="relative mb-4">
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
                      <div className="text-[10px] text-slate-500 font-mono">
                        Group: {usr.group || 'IC_DESIGN'} | node: {usr.host || 'local'} | project: {usr.project || 'Apollo'}
                      </div>
                    </div>

                    <div>
                      {currentUser.role === 'Admin' && usr.username !== currentUser.username ? (
                        <select
                          value={usr.role}
                          onChange={(e) => handleChangeRole(usr.id, e.target.value as UserRole)}
                          className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-[11px]"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Engineer">Engineer</option>
                        </select>
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
