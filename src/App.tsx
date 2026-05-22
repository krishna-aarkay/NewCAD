import React, { useState, useEffect } from 'react';
import { Cpu, Server, FileText, Calendar, BarChart3, ShieldAlert, User, LogOut, Sun, Moon } from 'lucide-react';
import { LicenseServer, UserProfile } from './types';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ServersList from './components/ServersList';
import OptionsManager from './components/OptionsManager';
import BorrowingTracker from './components/BorrowingTracker';
import ReportsView from './components/ReportsView';
import ComplianceViewer from './components/ComplianceViewer';
import ProfileSettings from './components/ProfileSettings';

type SubView = 'dashboard' | 'servers' | 'options' | 'borrowing' | 'reports' | 'compliance' | 'profile';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [servers, setServers] = useState<LicenseServer[]>([]);
  const [activeTab, setActiveTab] = useState<SubView>('dashboard');
  const [appInitialized, setAppInitialized] = useState<boolean>(false);

  // Dynamic API host determination - handles both dev server and standard production hosting seamlessly
  const apiHost = window.location.origin;

  useEffect(() => {
    // Attempt local-storage login session restore
    const cachedUser = localStorage.getItem('eda_lic_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setCurrentUser(parsed);
      } catch (err) {
        console.error('Error parsing session user', err);
      }
    }
    setAppInitialized(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchServers();
      // Periodically refresh servers summary status checkouts to keep dashboard dynamic
      const interval = setInterval(fetchServers, 8000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchServers = async () => {
    try {
      const res = await fetch(`${apiHost}/api/servers`, {
        headers: { 'x-user-id': currentUser?.username || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (err) {
      console.error('Failed fetching core servers mapping:', err);
    }
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('eda_lic_user', JSON.stringify(user));
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('eda_lic_user');
  };

  const handleUserChange = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('eda_lic_user', JSON.stringify(updatedUser));
  };

  if (!appInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium font-mono">Initializing EDA License Server environment...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLogin} apiHost={apiHost} />;
  }

  // Count critical compliance notifications
  const criticalsCount = servers.filter(s => {
    const lim = new Date(s.expiryDate).getTime();
    const diff = (lim - Date.now()) / (24 * 3600000);
    return s.status === 'offline' || diff < 15;
  }).length;

  const userInitials = currentUser.username ? currentUser.username.slice(0, 2).toUpperCase() : 'JD';

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* 1. Sidebar Left Panel */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col border-r border-slate-800 shadow-xl shrink-0">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-base tracking-tight leading-none">LicenceFlow Pro</span>
            <span className="text-[9px] text-slate-500 font-mono tracking-widest leading-none mt-1 uppercase">Control Console</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 text-sm font-medium">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'dashboard' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 opacity-70" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('servers')}
            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'servers' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4 opacity-70" />
            <span>License Servers</span>
          </button>

          <button
            onClick={() => setActiveTab('options')}
            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'options' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 opacity-70" />
            <span>Options Config</span>
          </button>

          <button
            onClick={() => setActiveTab('borrowing')}
            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'borrowing' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 opacity-70" />
            <span>Borrows & Leasing</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'reports' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 opacity-70" />
            <span>Usage per User</span>
          </button>

          <button
            onClick={() => setActiveTab('compliance')}
            className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer text-left ${
              activeTab === 'compliance' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <ShieldAlert className="w-4 h-4 opacity-70" />
              <span>Compliancy</span>
            </div>
            {criticalsCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {criticalsCount}
              </span>
            )}
          </button>
        </nav>

        {/* 2. Compact Alerts Widget inside sidebar */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-705">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Alerts</p>
            <div className="flex justify-between items-center text-xs">
              <span className={criticalsCount > 0 ? "text-orange-400 font-semibold" : "text-slate-400"}>
                {criticalsCount > 0 ? `${criticalsCount} Expiring Soon` : "Status: Optimal"}
              </span>
              <button
                onClick={() => setActiveTab('compliance')}
                className="text-slate-400 hover:text-white transition cursor-pointer text-[11px] underline"
              >
                View
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 3. Main Panel Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">Enterprise License Dashboard</h1>
            <div className="h-4 w-px bg-slate-300 mx-2 hidden sm:block"></div>
            <span className="text-xs sm:text-sm text-slate-500 hidden sm:inline-block font-medium">Global Environment</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick stats indicator */}
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] text-slate-600 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>GLOBAL READY</span>
            </div>

            {/* Quick Adaptive Role Switcher to guarantee feature accessibility in the preview */}
            <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1 gap-1.5 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-600 tracking-wider">ROLE TUNER:</span>
              <select
                value={currentUser.role}
                onChange={async (e) => {
                  const newRole = e.target.value as any;
                  try {
                    const res = await fetch(`${apiHost}/api/auth/profile`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': currentUser.username
                      },
                      body: JSON.stringify({ role: newRole })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.user) {
                        handleUserChange(data.user);
                      } else {
                        handleUserChange({ ...currentUser, role: newRole });
                      }
                    } else {
                      handleUserChange({ ...currentUser, role: newRole });
                    }
                  } catch (err) {
                    handleUserChange({ ...currentUser, role: newRole });
                  }
                }}
                className="bg-white text-xs font-semibold text-indigo-700 rounded px-1.5 py-0.5 border border-indigo-200 outline-none cursor-pointer hover:bg-slate-50 transition"
              >
                <option value="Admin">🛠️ Admin (Full Access)</option>
                <option value="Manager">📈 Manager (Compliance/Audit)</option>
                <option value="Engineer">💻 Engineer (Read-Only/Use)</option>
              </select>
            </div>

            {/* Profile and Logout info block */}
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 text-left hover:opacity-90 transition p-1 rounded-lg ${
                  activeTab === 'profile' ? 'bg-slate-100' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-blue-50">
                  {userInitials}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 leading-none">{currentUser.username}</p>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5 uppercase">{currentUser.role}</p>
                </div>
              </button>

              <button
                onClick={handleSignOut}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg cursor-pointer transition"
                title="Sign out of licensing session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation bar */}
        <div className="md:hidden bg-slate-900 border-b border-slate-800 overflow-x-auto py-2.5 px-4 flex gap-1.5 scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors ${
              activeTab === 'servers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Servers & Files
          </button>
          <button
            onClick={() => setActiveTab('options')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors ${
              activeTab === 'options' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Options Config
          </button>
          <button
            onClick={() => setActiveTab('borrowing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors ${
              activeTab === 'borrowing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Borrows
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors ${
              activeTab === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Usage Analytics
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md shrink-0 transition-colors relative ${
              activeTab === 'compliance' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Compliance</span>
            {criticalsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
                {criticalsCount}
              </span>
            )}
          </button>
        </div>

        {/* Inner Content Scroller Wrapper */}
        <div id="app-view-container" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 space-y-6">
          {/* Render active subview */}
          {activeTab === 'dashboard' && (
            <Dashboard
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
              onRefreshServers={fetchServers}
            />
          )}

          {activeTab === 'servers' && (
            <ServersList
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
              onRefreshData={fetchServers}
            />
          )}

          {activeTab === 'options' && (
            <OptionsManager
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
              onRefreshData={fetchServers}
            />
          )}

          {activeTab === 'borrowing' && (
            <BorrowingTracker
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
              onRefreshData={fetchServers}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
            />
          )}

          {activeTab === 'compliance' && (
            <ComplianceViewer
              apiHost={apiHost}
              currentUser={currentUser}
              servers={servers}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileSettings
              apiHost={apiHost}
              currentUser={currentUser}
              onChangeUser={handleUserChange}
            />
          )}

          {/* Bottom styling stamp */}
          <footer className="pt-8 pb-4 text-center text-[11px] text-slate-400 font-mono tracking-wider">
            LicenceFlow Pro © 2026 // Connected Workstation: {currentUser.host || 'localnode'} // FlexLM cluster mode: optimized
          </footer>
        </div>
      </main>
    </div>
  );
}
