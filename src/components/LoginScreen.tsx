import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Shield, Mail, User, Info, Building2, Cpu } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  apiHost: string;
}

export default function LoginScreen({ onLoginSuccess, apiHost }: LoginScreenProps) {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Admin' | 'Manager' | 'Engineer'>('Engineer');
  const [group, setGroup] = useState('IC_DESIGN_LEAD');
  const [project, setProject] = useState('Project_Apollo');
  const [host, setHost] = useState('workstation-local');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if server is initialized with users
  useEffect(() => {
    checkInitialization();
  }, []);

  const checkInitialization = async () => {
    try {
      const res = await fetch(`${apiHost}/api/auth/initialized`);
      const data = await res.json();
      setIsInitialized(data.initialized);
    } catch (err) {
      console.error('Error contacting authorization server:', err);
      // Fallback
      setIsInitialized(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please provide your username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiHost}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Connecting server failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setError('Username and Email are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiHost}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          role,
          group,
          project,
          host
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'First login registration failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'First login initial registry failed');
    } finally {
      setLoading(false);
    }
  };

  if (isInitialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">Contacting authorization server...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-50 text-blue-600 mb-4 border border-blue-100">
            <Cpu className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {isInitialized ? 'EDA License Control Center' : 'Bootstrap License Server Admin'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {isInitialized 
              ? 'Enter your workstation username to connect your CAD account' 
              : 'Create the primary Administrator profile to configure the license servers.'}
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg flex items-start gap-2 animate-pulse">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isInitialized ? (
          // Standard login form
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Workstation ID / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. sowjanyanarava541 or alex_k"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
              
              <div className="text-center">
                <span className="text-xs text-slate-400">
                  Demo profiles hint: Use <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">admin</code> or <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">alex_k</code>
                </span>
                <button
                  type="button"
                  onClick={() => setIsInitialized(false)}
                  className="block w-full mt-3 text-xs text-blue-500 hover:underline text-center"
                >
                  Create another new user login profile
                </button>
              </div>
            </div>
          </form>
        ) : (
          // Admin / User Bootstrap Sign up form
          <form className="mt-8 space-y-5" onSubmit={handleSignup}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Workstation Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. sowjanyanarava541"
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Professional Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sowjanyanarava541@gmail.com"
                    className="block w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  >
                    <option value="Admin">Administrator</option>
                    <option value="Manager">Manager / Lead</option>
                    <option value="Engineer">Design Engineer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    User Family Group
                  </label>
                  <input
                    type="text"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="e.g. IC_DESIGN_LEAD"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Client Node/Host
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="workstation-01"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Primary Project Name
                  </label>
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                  >
                    <option value="Project_Apollo">Project Apollo (EDA)</option>
                    <option value="Project_Zephyr">Project Zephyr</option>
                    <option value="Project_Titan">Project Titan</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
              >
                {loading ? 'Initializing...' : 'Register Profile & Login'}
              </button>
              
              {isInitialized === false && (
                <button
                  type="button"
                  onClick={() => setIsInitialized(true)}
                  className="block w-full text-xs text-slate-400 hover:text-slate-600 text-center"
                >
                  Back to standard sign-in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
