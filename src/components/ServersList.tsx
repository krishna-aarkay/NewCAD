import React, { useState, useMemo, useRef } from 'react';
import { Database, Plus, RefreshCw, Server, Trash2, Edit3, ArrowUpCircle, Play, Download, Upload, AlertCircle, Terminal, HelpCircle, Search, Clock, ArrowUpRight, CheckCircle, ListFilter, Activity, Calendar } from 'lucide-react';
import { LicenseServer, UserProfile } from '../types';

interface ServersListProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
  onRefreshData: () => void;
}

export default function ServersList({ apiHost, currentUser, servers, onRefreshData }: ServersListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedServer, setSelectedServer] = useState<LicenseServer | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Custom switch state for single-page unified features ledgers
  const [viewMode, setViewMode] = useState<'topology' | 'features'>('topology');
  
  // Filtering and query controls for the aggregated features directory
  const [featureSearch, setFeatureSearch] = useState('');
  const [congestionFilter, setCongestionFilter] = useState<'all' | 'high' | 'full' | 'idle'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'soon' | 'active'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'expiry' | 'quantity'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Create Server form states
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'cadence' | 'synopsys' | 'mentor' | 'other'>('cadence');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('5280');
  const [expiryDate, setExpiryDate] = useState('2026-12-31');
  const [featName, setFeatName] = useState('');
  const [featTotal, setFeatTotal] = useState('50');
  const [featuresList, setFeaturesList] = useState<{name: string, total: number}[]>([]);
  
  // SSH state variables
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('');
  const [sshPassword, setSshPassword] = useState('');

  // Editing state variables for existing servers
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editPort, setEditPort] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editSshEnabled, setEditSshEnabled] = useState(false);
  const [editSshHost, setEditSshHost] = useState('');
  const [editSshPort, setEditSshPort] = useState('22');
  const [editSshUsername, setEditSshUsername] = useState('');
  const [editSshPassword, setEditSshPassword] = useState('');
  
  // Custom License File Editor state
  const [licenseFileText, setLicenseFileText] = useState('');
  const [showLicEditor, setShowLicEditor] = useState(false);
  const [showLicPreview, setShowLicPreview] = useState(false);

  // File upload and drag-and-drop processing states
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [parsedPreviewFeatures, setParsedPreviewFeatures] = useState<Array<{ name: string; total: number; expiryDate: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Command console output state
  const [cliOutput, setCliOutput] = useState<string>('Console initialized. Select a license server and execute lmreread, lmdown or boot commands to inspect logs.');

  // Collect and aggregate features across all registered servers
  const allFeaturesCombined = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      total: number;
      used: number;
      expiryDate: string;
      serverId: string;
      serverName: string;
      serverHost: string;
      serverPort: number;
      serverStatus: 'online' | 'offline';
      serverType: string;
    }> = [];

    servers.forEach(srv => {
      srv.features.forEach((feat, index) => {
        list.push({
          id: `${srv.id}-${feat.name}-${index}`,
          name: feat.name,
          total: feat.total,
          used: feat.used,
          expiryDate: feat.expiryDate || srv.expiryDate || 'N/A',
          serverId: srv.id,
          serverName: srv.name,
          serverHost: srv.host,
          serverPort: srv.port,
          serverStatus: srv.status,
          serverType: srv.type
        });
      });
    });

    return list;
  }, [servers]);

  // Aggregate KPI stats from all features
  const featuresStats = useMemo(() => {
    let totalFeatures = allFeaturesCombined.length;
    let totalLicensesAllocated = 0;
    let totalLicensesUsed = 0;
    let expiringSoonCount = 0;

    const limitDate = Date.now() + 30 * 24 * 3600 * 1000; // 30 days out

    allFeaturesCombined.forEach(feat => {
      totalLicensesAllocated += feat.total;
      totalLicensesUsed += feat.used;

      if (feat.expiryDate && feat.expiryDate !== 'N/A') {
        const expTime = new Date(feat.expiryDate).getTime();
        if (!isNaN(expTime) && expTime <= limitDate && expTime >= Date.now()) {
          expiringSoonCount++;
        }
      }
    });

    return {
      totalFeatures,
      totalLicensesAllocated,
      totalLicensesUsed,
      expiringSoonCount
    };
  }, [allFeaturesCombined]);

  // Filter the aggregated features list
  const filteredFeatures = useMemo(() => {
    const filtered = allFeaturesCombined.filter(feat => {
      // Search matching feature name or server metadata
      const matchSearch = 
        feat.name.toLowerCase().includes(featureSearch.toLowerCase()) || 
        feat.serverName.toLowerCase().includes(featureSearch.toLowerCase()) ||
        feat.serverHost.toLowerCase().includes(featureSearch.toLowerCase());

      if (!matchSearch) return false;

      // Congestion levels
      const pct = feat.total > 0 ? (feat.used / feat.total) * 100 : 0;
      if (congestionFilter === 'high' && pct < 80) return false;
      if (congestionFilter === 'full' && feat.used < feat.total) return false;
      if (congestionFilter === 'idle' && feat.used > 0) return false;

      // Expirations
      if (expiryFilter === 'soon') {
        const limitDate = Date.now() + 30 * 24 * 3600 * 1000;
        const expTime = new Date(feat.expiryDate).getTime();
        if (isNaN(expTime) || expTime > limitDate || expTime < Date.now()) return false;
      } else if (expiryFilter === 'active') {
        const expTime = new Date(feat.expiryDate).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) return false;
      }

      return true;
    });

    // Handle Sorting by feature name, expire date, or usage quantity
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'expiry') {
        const timeA = a.expiryDate === 'N/A' ? Infinity : new Date(a.expiryDate).getTime();
        const timeB = b.expiryDate === 'N/A' ? Infinity : new Date(b.expiryDate).getTime();
        comparison = (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
      } else if (sortBy === 'quantity') {
        comparison = a.total - b.total;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allFeaturesCombined, featureSearch, congestionFilter, expiryFilter, sortBy, sortOrder]);

  // Render a dynamic badge for feature expiration date
  const getExpiryBadge = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return <span className="text-slate-400 font-mono text-[11px]">No Date</span>;
    const expTime = new Date(dateStr).getTime();
    if (isNaN(expTime)) return <span className="text-slate-400 font-mono text-[11px]">{dateStr}</span>;

    const diffMs = expTime - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-semibold rounded-md">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          EXPIRED ({Math.abs(diffDays)}d ago)
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-md">
          <Clock className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
          Expiring in {diffDays}d
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium rounded-md">
          Active ({dateStr})
        </span>
      );
    }
  };

  // Render warning visual indicators for servers expiring soon
  const getServerExpiryBadge = (srv: LicenseServer) => {
    let minDiffDays = Infinity;
    let isExpired = false;

    const evalDate = (dateStr: string) => {
      if (!dateStr || dateStr === 'N/A') return;
      const expTime = new Date(dateStr).getTime();
      if (isNaN(expTime)) return;
      
      const diffMs = expTime - Date.now();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        isExpired = true;
      } else if (diffDays <= 30) {
        if (diffDays < minDiffDays) {
          minDiffDays = diffDays;
        }
      }
    };

    // Evaluate server general expiry and individual features
    evalDate(srv.expiryDate);
    if (srv.features) {
      srv.features.forEach(feat => evalDate(feat.expiryDate));
    }

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 border border-rose-250 text-rose-700 text-[9px] font-black rounded tracking-normal uppercase">
          <AlertCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
          Expired
        </span>
      );
    }

    if (minDiffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-250 text-amber-700 text-[9px] font-bold rounded tracking-normal uppercase animate-pulse">
          <Clock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
          Expiring &le;{minDiffDays}d
        </span>
      );
    }

    return null;
  };

  const handleAddFeature = () => {
    if (!featName) return;
    setFeaturesList([...featuresList, { name: featName.trim(), total: parseInt(featTotal) || 10 }]);
    setFeatName('');
    setFeatTotal('50');
  };

  const handleRemoveFeatureTemp = (idx: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== idx));
  };

  // Submit adding new server
  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newHost || !newPort) return;

    try {
      const res = await fetch(`${apiHost}/api/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          name: newName,
          type: newType,
          host: newHost,
          port: parseInt(newPort) || 27000,
          expiryDate: expiryDate,
          features: featuresList,
          sshEnabled: sshEnabled,
          sshHost: sshHost || undefined,
          sshPort: sshPort ? parseInt(sshPort) : undefined,
          sshUsername: sshUsername || undefined,
          sshPassword: sshPassword || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server creation failed');
      }

      // Reset
      setNewName('');
      setNewType('cadence');
      setNewHost('');
      setNewPort('27000');
      setFeaturesList([]);
      setSshEnabled(false);
      setSshHost('');
      setSshPort('22');
      setSshUsername('');
      setSshPassword('');
      setShowAddForm(false);
      onRefreshData();
    } catch (err: any) {
      alert(`Error creating server: ${err.message}`);
    }
  };

  // Start server editing session
  const startEditingServer = (srv: LicenseServer) => {
    setEditName(srv.name || '');
    setEditHost(srv.host || '');
    setEditPort(srv.port ? String(srv.port) : '27000');
    setEditExpiryDate(srv.expiryDate || '');
    setEditSshEnabled(!!srv.sshEnabled);
    setEditSshHost(srv.sshHost || '');
    setEditSshPort(srv.sshPort ? String(srv.sshPort) : '22');
    setEditSshUsername(srv.sshUsername || '');
    setEditSshPassword(srv.sshPassword || '');
    setIsEditingServer(true);
  };

  // Submit updating existing server
  const handleUpdateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer || !editName || !editHost || !editPort) return;

    try {
      const res = await fetch(`${apiHost}/api/servers/${selectedServer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          name: editName,
          host: editHost,
          port: parseInt(editPort) || 27000,
          expiryDate: editExpiryDate,
          sshEnabled: editSshEnabled,
          sshHost: editSshHost || undefined,
          sshPort: editSshPort ? parseInt(editSshPort) : undefined,
          sshUsername: editSshUsername || undefined,
          sshPassword: editSshPassword || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server updates failed');
      }

      const data = await res.json();
      setIsEditingServer(false);
      setSelectedServer(data.server);
      onRefreshData();
    } catch (err: any) {
      alert(`Error updating server: ${err.message}`);
    }
  };

  // Trigger lmdown, lmreread, lmup (online)
  const triggerServerAction = async (srvId: string, action: 'lmdown' | 'lmreread' | 'lmup') => {
    setActionLoading(srvId + '-' + action);
    setCliOutput(`[FLEXLM_CLI] Executing daemon control signal: lmutil ${action} on discrete server...\nWaiting for vendor lock...`);
    
    try {
      const res = await fetch(`${apiHost}/api/servers/${srvId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Control action command failed');

      setCliOutput(data.output || 'Action executed successfully.');
      
      // Update selected server reference in state if open
      if (selectedServer && selectedServer.id === srvId) {
        setSelectedServer(data.server);
      }
      onRefreshData();
    } catch (err: any) {
      setCliOutput(`[CLI_FATAL_ERROR] Command execution interrupted:\n${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Upload license file text to parse features and update database capacity
  const handleUploadLicensefile = async (srvId: string) => {
    if (!licenseFileText.trim()) return;
    try {
      const res = await fetch(`${apiHost}/api/servers/${srvId}/license-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ content: licenseFileText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed parsing license file');

      alert(`Success! Successfully parsed license file. Recalibrated features capacity.`);
      setSelectedServer(data.server);
      setShowLicEditor(false);
      onRefreshData();
    } catch (err: any) {
      alert(`Parsing fault: ${err.message}`);
    }
  };

  const deleteServer = async (srvId: string) => {
    if (!window.confirm('Are you absolutely sure you want to remove this licensing server and disable all feature pools?')) return;
    try {
      const res = await fetch(`${apiHost}/api/servers/${srvId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.username }
      });
      if (!res.ok) throw new Error('Failed to delete server');
      
      setSelectedServer(null);
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSelectServer = (srv: LicenseServer) => {
    setSelectedServer(srv);
    setLicenseFileText(srv.licenseFileContent || '');
    setShowLicEditor(false);
    setShowLicPreview(false);
    setUploadedFile(null);
    setParsedPreviewFeatures([]);
    setIsEditingServer(false);
  };

  // Event handlers and parsing helpers for file drop and select upload
  const parseLicenseFileLocally = (text: string) => {
    const lines = text.split('\n');
    const features: Array<{ name: string; total: number; expiryDate: string }> = [];
    
    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith('FEATURE') || cleanLine.startsWith('INCREMENT')) {
        const parts = cleanLine.split(/\s+/);
        if (parts.length >= 6) {
          const name = parts[1];
          const rawDate = parts[4];
          const rawTotal = parts[5];
          
          let cleanDate = '2026-12-31';
          if (rawDate) {
            const match = rawDate.match(/(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})/i);
            if (match) {
              const months: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
              };
              const d = match[1].padStart(2, '0');
              const m = months[match[2].toLowerCase()];
              const y = match[3];
              cleanDate = `${y}-${m}-${d}`;
            }
          }
          features.push({
            name,
            total: Number(rawTotal) || 20,
            expiryDate: cleanDate,
          });
        }
      }
    });
    
    setParsedPreviewFeatures(features);
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setLicenseFileText(text);
        setUploadedFile({ name: file.name, size: file.size });
        parseLicenseFileLocally(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileRead(e.target.files[0]);
    }
  };

  // Dynamic status badges
  const getSrvStatusBadge = (status: 'online' | 'offline') => {
    if (status === 'online') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        OFFLINE
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Mode Switching Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl border border-slate-200 shadow-xs gap-4 text-left">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" /> License Servers & Features Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage server status, read license files, and audit global EDA software feature pools.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode('topology')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'topology' ? 'bg-white text-blue-600 shadow-xs font-bold border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Server Topology
          </button>
          <button
            onClick={() => setViewMode('features')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'features' ? 'bg-white text-blue-600 shadow-xs font-bold border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            All Features Directory
          </button>
        </div>
      </div>

      {viewMode === 'topology' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Left side list: servers */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-slate-400" /> License Servers ({servers.length})
                </h3>
                {currentUser.role === 'Admin' && (
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Server
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {servers.map((srv) => {
                  const srvPct = srv.totalLicenses > 0 ? Math.round((srv.usedLicenses / srv.totalLicenses) * 100) : 0;
                  return (
                    <div
                      key={srv.id}
                      onClick={() => handleSelectServer(srv)}
                      className={`p-4 rounded-lg border transition cursor-pointer text-left ${selectedServer?.id === srv.id ? 'border-blue-500 bg-blue-50/20' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <div className="flex gap-4 items-stretch justify-between">
                        {/* Left: Server details & actions */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                          <div>
                            <h4 className="font-display font-semibold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                              <span>{srv.name}</span>
                              {getServerExpiryBadge(srv)}
                            </h4>
                            <div className="text-[11px] text-slate-500 font-mono mt-1 space-y-0.5">
                              <div className="truncate">Host: {srv.host}:{srv.port}</div>
                              <div>Vendor Type: {srv.type.toUpperCase()}</div>
                              <div className="flex items-center gap-1 mt-1 text-slate-400">
                                <span>Keys expiry:</span>
                                <span className="font-semibold">{srv.expiryDate}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {srv.status === 'online' ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); triggerServerAction(srv.id, 'lmdown'); }}
                                className="px-2 py-1 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold border border-rose-100 rounded cursor-pointer transition"
                              >
                                Shutdown
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); triggerServerAction(srv.id, 'lmup'); }}
                                className="px-2 py-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-semibold border border-emerald-100 rounded cursor-pointer transition"
                              >
                                Power up
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); triggerServerAction(srv.id, 'lmreread'); }}
                              className="px-2 py-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold border border-indigo-100 rounded cursor-pointer transition"
                            >
                              Reread Opts
                            </button>
                          </div>
                        </div>

                        {/* Right: Status indicator & Dynamic license usage bar graph */}
                        <div className="w-1/3 shrink-0 flex flex-col justify-between border-l border-slate-100 pl-3.5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {/* Rich Status Indicator */}
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5" title={`Server is ${srv.status}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${srv.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-550 bg-rose-500'}`} />
                              <span className={`text-[9px] font-bold tracking-wider font-mono uppercase ${srv.status === 'online' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {srv.status}
                              </span>
                            </div>
                            
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-slate-400 font-mono" title="License expiration">
                              <Calendar className="w-2 h-2 text-slate-300" />
                              EXP: {srv.expiryDate}
                            </span>
                          </div>

                          {/* License Usage representation */}
                          <div className="space-y-1 mt-auto">
                            <div className="text-[9px] font-mono text-slate-500 flex justify-between items-baseline gap-1">
                              <span className="text-slate-400 uppercase tracking-tight">UTIL:</span>
                              <span className="font-bold text-slate-705">{srvPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/40">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  srv.status === 'offline' 
                                    ? 'bg-slate-300' 
                                    : srvPct >= 90 
                                      ? 'bg-rose-500' 
                                      : srvPct >= 70 
                                        ? 'bg-amber-500' 
                                        : 'bg-emerald-500'
                                }`} 
                                style={{ width: `${Math.min(100, srvPct)}%` }} 
                              />
                            </div>
                            <div className="text-[8px] font-mono text-slate-400 font-semibold">
                              {srv.usedLicenses} / {srv.totalLicenses} LIC
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create Server Form Inline overlay toggle */}
            {showAddForm && (
              <form onSubmit={handleCreateServer} className="bg-white p-5 rounded-xl border border-slate-200 shadow-md text-left space-y-4">
                <h4 className="font-display font-semibold text-slate-900 text-sm">Add New EDA Server</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Server Friendly Name</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Mentor Analytics Pool"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">CAD vendor daemon</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="cadence">Cadence (cdslmd)</option>
                        <option value="synopsys">Synopsys (snpslmd)</option>
                        <option value="mentor">Mentor (mgcld)</option>
                        <option value="other">Other / Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Default global expiry</label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Host Hostname</label>
                      <input
                        type="text"
                        required
                        value={newHost}
                        onChange={(e) => setNewHost(e.target.value)}
                        placeholder="mentor-lic.corp.local"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">TCP IP Port</label>
                      <input
                        type="text"
                        required
                        value={newPort}
                        onChange={(e) => setNewPort(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase mb-1">Initial Features Table</span>
                    <div className="flex gap-1.5 mb-2">
                      <input
                        type="text"
                        value={featName}
                        onChange={(e) => setFeatName(e.target.value)}
                        placeholder="feat_name"
                        className="flex-1 px-2.5 py-1 border border-slate-300 rounded-md text-xs font-mono"
                      />
                      <input
                        type="number"
                        value={featTotal}
                        onChange={(e) => setFeatTotal(e.target.value)}
                        className="w-16 px-2.5 py-1 border border-slate-300 rounded-md text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddFeature}
                        className="px-2.5 py-1 bg-slate-800 text-white font-semibold rounded text-xs hover:bg-slate-900 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {featuresList.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-700 font-mono">
                          {f.name}: {f.total}
                          <Trash2 onClick={() => handleRemoveFeatureTemp(i)} className="w-3 h-3 text-red-500 cursor-pointer" />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* SSH Configuration toggle and fields */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">Enable SSH Connection</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">Allow remote daemon control & configs via SSH</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={sshEnabled} 
                          onChange={(e) => setSshEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {sshEnabled && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 transition-all">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">SSH Host</label>
                            <input
                              type="text"
                              value={sshHost}
                              onChange={(e) => setSshHost(e.target.value)}
                              placeholder={newHost || "10.0.1.5"}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">SSH Port</label>
                            <input
                              type="text"
                              value={sshPort}
                              onChange={(e) => setSshPort(e.target.value)}
                              placeholder="22"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono bg-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">SSH User</label>
                            <input
                              type="text"
                              value={sshUsername}
                              onChange={(e) => setSshUsername(e.target.value)}
                              placeholder="lmadmin"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">SSH Password</label>
                            <input
                              type="password"
                              value={sshPassword}
                              onChange={(e) => setSshPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-[11px] font-mono bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                  >
                    Create pool
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 2. Middle & Right sides: server details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedServer ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-display font-semibold text-slate-900 text-xl tracking-tight uppercase leading-none">{selectedServer.name}</h3>
                      {getServerExpiryBadge(selectedServer)}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md font-mono" title="Global License Expiry Date">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        EXP: {selectedServer.expiryDate}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">ID: {selectedServer.id} | Host: {selectedServer.host}:{selectedServer.port}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLicPreview(!showLicPreview)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        showLicPreview
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                      title={showLicPreview ? "Hide License Preview" : "Show License Preview"}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      {showLicPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                    {currentUser.role === 'Admin' && (
                      <button
                        onClick={() => deleteServer(selectedServer.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer"
                        title="Remove server"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* License file preview block */}
                {showLicPreview && (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-left font-mono">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[11px] text-teal-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" /> License File Active Content (.lic payload)
                      </span>
                      <span className="text-[10px] text-slate-450 font-mono">SCROLLABLE PREVIEW (READ-ONLY)</span>
                    </div>
                    <textarea
                      readOnly
                      rows={8}
                      className="w-full bg-slate-950 text-slate-300 font-mono text-xs rounded border border-transparent focus:outline-none resize-y p-2.5 leading-relaxed focus:ring-0"
                      value={selectedServer.licenseFileContent || '# No license content stored on this server.'}
                    />
                  </div>
                )}

                {/* General metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total Licenses</span>
                    <span className="text-xl font-semibold tracking-tight text-slate-800">{selectedServer.totalLicenses}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Checked out</span>
                    <span className="text-xl font-semibold tracking-tight text-slate-800">{selectedServer.usedLicenses}</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Available</span>
                    <span className="text-xl font-semibold tracking-tight text-emerald-600">{Math.max(0, selectedServer.totalLicenses - selectedServer.usedLicenses)}</span>
                  </div>
                </div>

                {/* Features pool mapping */}
                <div>
                  <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">Licensed Tool Features Mapping</h4>
                  {selectedServer.features.length === 0 ? (
                    <div className="p-4 border border-dashed text-center text-xs text-slate-400 rounded-lg">
                      No discrete features parsed yet inside this server stream. Paste a valid license file content below.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedServer.features.map(feat => {
                        const pct = feat.total > 0 ? Math.round((feat.used / feat.total) * 100) : 0;
                        return (
                          <div key={feat.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-lg text-xs space-y-2">
                            <div className="flex justify-between items-baseline font-mono text-[11px]">
                              <div>
                                <span className="font-bold text-slate-805 text-xs">{feat.name}</span>
                                <span className="text-[10px] text-zinc-400 ml-2">Expires: {feat.expiryDate}</span>
                              </div>
                              <span className="font-semibold text-slate-600">{feat.used} of {feat.total} checked out ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-200/60 h-2 rounded-full overflow-hidden">
                              <div className={`h-full transition-all ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Files update and Download Option */}
                <div className="p-4 bg-blue-50/20 border border-blue-100 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-blue-500" /> License File Update & Download
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Edit high-volume license files or drag and upload .lic files to parse features and update server capacities.</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const element = document.createElement("a");
                          const file = new Blob([selectedServer.licenseFileContent || ''], {type: 'text/plain'});
                          element.href = URL.createObjectURL(file);
                          element.download = `${selectedServer.type}_licenses.lic`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                        className="p-1 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" /> Download .lic
                      </button>
                      {currentUser.role === 'Admin' && (
                        <button
                          onClick={() => setShowLicEditor(!showLicEditor)}
                          className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Parse New File
                        </button>
                      )}
                    </div>
                  </div>

                  {currentUser.role === 'Admin' && (
                    <div className="space-y-3 pt-1">
                      {/* Hidden file input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        id="license-file-upload"
                        accept=".lic,.txt,*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      
                      {/* Drag & Drop Area */}
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                          dragActive 
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/10'
                        }`}
                      >
                        <div className="space-y-2 pointer-events-none">
                          <div className={`p-2.5 rounded-full mx-auto w-fit transition-colors ${
                            dragActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500'
                          }`}>
                            <Upload className="w-5 h-5" />
                          </div>
                          
                          <div className="text-xs font-medium text-slate-700">
                            <span className="text-blue-600 hover:text-blue-500 font-bold transition">Click to select license file</span> or drag and drop
                          </div>
                          <p className="text-[10px] text-slate-455 uppercase font-mono tracking-wide">Accepts .lic or .txt templates</p>
                        </div>
                      </div>

                      {/* Display Selected File Info & Client-Side Parse Preview */}
                      {uploadedFile && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2.5 text-left shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-700 block truncate" title={uploadedFile.name}>{uploadedFile.name}</span>
                              <span className="text-[10px] text-slate-404 font-mono text-slate-450">{(uploadedFile.size / 1024).toFixed(2)} KB</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedFile(null);
                                setLicenseFileText(selectedServer.licenseFileContent || '');
                                setParsedPreviewFeatures([]);
                              }}
                              className="text-slate-500 hover:text-rose-600 px-2 py-1 font-semibold text-[10px] uppercase border border-slate-200 rounded bg-slate-50 hover:bg-rose-50 tracking-wider whitespace-nowrap transition cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>

                          {parsedPreviewFeatures.length > 0 ? (
                            <div className="bg-slate-50/85 p-2.5 rounded border border-slate-200/60 space-y-1.5 font-mono text-[10px]">
                              <div className="font-bold text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-200/60 pb-1 flex justify-between">
                                <span>Parsed Local Preview</span>
                                <span className="text-emerald-600 font-bold">{parsedPreviewFeatures.length} FEATURES</span>
                              </div>
                              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                {parsedPreviewFeatures.slice(0, 5).map((f, i) => (
                                  <div key={i} className="flex justify-between text-slate-600">
                                    <span className="font-semibold truncate max-w-[150px]">{f.name}</span>
                                    <span className="text-slate-500 shrink-0">QTY: {f.total} ({f.expiryDate})</span>
                                  </div>
                                ))}
                                {parsedPreviewFeatures.length > 5 && (
                                  <div className="text-[9px] text-slate-400 italic text-center pt-0.5 border-t border-dashed border-slate-200">
                                    + {parsedPreviewFeatures.length - 5} more features in file
                                  </div>
                                )}
                              </div>
                              <div className="text-[9px] font-bold text-blue-600 uppercase tracking-tight pt-1 flex justify-between items-baseline">
                                <span>TOTAL POOL CAPACITY:</span>
                                <span className="text-[11px] font-extrabold text-blue-700">
                                  {parsedPreviewFeatures.reduce((acc, f) => acc + f.total, 0)} LIC
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-amber-50 text-amber-700 text-[10px] rounded border border-amber-100 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>No features could be parsed. Check syntax matches standard FlexLM structures.</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleUploadLicensefile(selectedServer.id)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
                            disabled={parsedPreviewFeatures.length === 0}
                          >
                            <CheckCircle className="w-4 h-4" /> Apply {parsedPreviewFeatures.length} Parsed Features & Capacities
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {showLicEditor && currentUser.role === 'Admin' && (
                    <div className="space-y-3.5 border-t border-slate-200/60 pt-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">FlexLM license text (.lic syntax)</label>
                        <div className="text-[10px] bg-slate-100 text-slate-600 p-2.5 rounded-md mb-2 font-mono">
                          Format: <code className="font-bold text-slate-900">FEATURE feature_name vendor_daemon version expiry_date capacity</code><br />
                          Example: <code className="text-indigo-600">FEATURE virtuoso_schematic cdslmd 1.0 12-may-2027 80 SIGN=&quot;A7F1&quot;</code>
                        </div>
                        <textarea
                          rows={6}
                          value={licenseFileText}
                          onChange={(e) => {
                            setLicenseFileText(e.target.value);
                            parseLicenseFileLocally(e.target.value);
                          }}
                          className="w-full p-2.5 bg-slate-900 text-teal-400 font-mono text-xs rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="# FLEXlm License file"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setShowLicEditor(false)}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUploadLicensefile(selectedServer.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                        >
                          Submit & Regenerate Feature Pools
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CMD console output history specifically for selected server */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col h-48 font-mono">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-2">
                    <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-slate-300">flexlm-logs://{selectedServer.host}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <pre className="text-[11px] text-emerald-405 whitespace-pre-wrap leading-relaxed">
                      {cliOutput}
                    </pre>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-sm h-full flex flex-col items-center justify-center">
                <Server className="w-12 h-12 text-slate-300 mb-3" />
                <span className="font-semibold text-slate-650 font-display">No server selected</span>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Select a master server from the left navigation panel to view parsed features mapping, edit configurations, update license files and execute FlexLM actions.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* UNIFIED ALL FEATURES LEDGER DIRECTORY VIEW */
        <div className="space-y-6">
          {/* KPI Mini-Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Distinct Features</span>
                <span className="text-lg font-bold text-slate-800">{featuresStats.totalFeatures}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Combined Keys Used</span>
                <span className="text-lg font-bold text-slate-800">
                  {featuresStats.totalLicensesUsed} <span className="text-xs text-slate-400 font-normal">/ {featuresStats.totalLicensesAllocated}</span>
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Global Capacity Filled</span>
                <span className="text-lg font-bold text-slate-800">
                  {featuresStats.totalLicensesAllocated > 0 ? Math.round((featuresStats.totalLicensesUsed / featuresStats.totalLicensesAllocated) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Expiring Pools (&le; 30d)</span>
                <span className="text-lg font-bold text-amber-600">{featuresStats.expiringSoonCount}</span>
              </div>
            </div>
          </div>

          {/* Filters Workbench */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-left">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search master features by identifier name, parent server name, or host..."
                value={featureSearch}
                onChange={(e) => setFeatureSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Filters:</span>
              </div>

              <select
                value={congestionFilter}
                onChange={(e) => setCongestionFilter(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">Sparsity: All Levels</option>
                <option value="high">Congested (&ge;80% checked out)</option>
                <option value="full">Drained (100% Saturated)</option>
                <option value="idle">Idle / Free (0% Saturated)</option>
              </select>

              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="all">Licensing Expiry: All</option>
                <option value="soon">Critical Expiry (Within 30 Days)</option>
                <option value="active">Active Pools</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="name">Sort: Feature Name</option>
                <option value="expiry">Sort: Expiry Date</option>
                <option value="quantity">Sort: Allocation Total</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 cursor-pointer focus:outline-none"
              >
                <option value="asc">Ascending order ↑</option>
                <option value="desc">Descending order ↓</option>
              </select>

              {(featureSearch || congestionFilter !== 'all' || expiryFilter !== 'all' || sortBy !== 'name' || sortOrder !== 'asc') && (
                <button
                  onClick={() => {
                    setFeatureSearch('');
                    setCongestionFilter('all');
                    setExpiryFilter('all');
                    setSortBy('name');
                    setSortOrder('asc');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Master Ledger List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto text-left">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    <th className="py-3 px-5">EDA Feature Identifier</th>
                    <th className="py-3 px-5">Hosting Daemon / Server</th>
                    <th className="py-3 px-5">Allocation Consumption</th>
                    <th className="py-3 px-5 text-right">Expiration Timeline</th>
                    <th className="py-3 px-5 text-center">Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs">
                  {filteredFeatures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        No matching software features discovered under this criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFeatures.map(feat => {
                      const usagePct = feat.total > 0 ? Math.round((feat.used / feat.total) * 100) : 0;
                      return (
                        <tr key={feat.id} className="hover:bg-slate-50/40 transition">
                          <td className="py-4 px-5">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="font-mono font-bold text-slate-800 text-[13px] tracking-tight">{feat.name}</span>
                              <span className="inline-flex items-center text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider text-slate-600">
                                {feat.serverType}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <div className="space-y-0.5 text-slate-600">
                              <span className="font-semibold block uppercase text-slate-800 text-[11px]">{feat.serverName}</span>
                              <span className="text-[10px] text-slate-400 font-mono block">flexlm-peer://{feat.serverHost}:{feat.serverPort}</span>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <div className="space-y-1.5 max-w-[220px]">
                              <div className="flex justify-between items-baseline font-mono text-[10px]">
                                <span className="font-bold text-slate-800">{feat.used} <span className="text-slate-400 font-normal">of</span> {feat.total} used</span>
                                <span className="font-semibold text-slate-500">{usagePct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all rounded-full ${
                                    usagePct >= 90 ? 'bg-rose-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                                  }`} 
                                  style={{ width: `${Math.min(100, usagePct)}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-right font-mono">
                            {getExpiryBadge(feat.expiryDate)}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <button
                              onClick={() => {
                                const matchedSrv = servers.find(s => s.id === feat.serverId);
                                if (matchedSrv) {
                                  setSelectedServer(matchedSrv);
                                  setViewMode('topology');
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 hover:text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer border border-slate-200 hover:border-transparent hover:shadow-xs"
                            >
                              <span>Manage Server</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 hover:text-white font-bold" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>LEDGER SCAN: COMPLETE SYNC</span>
              <span>LISTING {filteredFeatures.length} TOTAL EDA FEATURE POOLS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
