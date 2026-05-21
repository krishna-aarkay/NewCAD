import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Cpu, Terminal, Users, Database, Play, CheckCircle, RefreshCw, AlertTriangle, PlayCircle, LogOut } from 'lucide-react';
import { LicenseServer, Checkout, UserProfile } from '../types';

interface DashboardProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
  onRefreshServers: () => void;
}

export default function Dashboard({ apiHost, currentUser, servers, onRefreshServers }: DashboardProps) {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [preemptionLoading, setPreemptionLoading] = useState(false);
  const [terminalMsg, setTerminalMsg] = useState<string>('Terminal initialized. Waiting for interactive simulations...');

  // Filters for Server node and Vendor daemon type
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');

  // Search inputs for active checkouts (users using feature, and features used by user)
  const [searchUsername, setSearchUsername] = useState<string>('');
  const [searchFeatureName, setSearchFeatureName] = useState<string>('');

  // Simulation state values
  const [simServer, setSimServer] = useState('');
  const [simFeature, setSimFeature] = useState('');
  const [simUser, setSimUser] = useState(currentUser.username);
  const [simHost, setSimHost] = useState(currentUser.host || 'node-local');
  const [simProj, setSimProj] = useState(currentUser.project || 'Project_Apollo');

  useEffect(() => {
    fetchDashboardData();
    // Default select first online server feature
    if (servers.length > 0) {
      const onlineSrv = servers.find(s => s.status === 'online');
      if (onlineSrv) {
        setSimServer(onlineSrv.id);
        if (onlineSrv.features.length > 0) {
          setSimFeature(onlineSrv.features[0].name);
        }
      } else {
        setSimServer(servers[0].id);
        if (servers[0].features.length > 0) {
          setSimFeature(servers[0].features[0].name);
        }
      }
    }
  }, [servers]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch active checkouts
      const coRes = await fetch(`${apiHost}/api/checkouts`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const coData = await coRes.json();
      setCheckouts(coData.checkouts || []);

      // 2. Fetch usage reports for past 30 days
      const repRes = await fetch(`${apiHost}/api/reports/usage`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const repData = await repRes.json();
      setUsageStats(repData);
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Keep simulator feature dropdown in sync with server dropdown
  const handleServerChange = (srvId: string) => {
    setSimServer(srvId);
    const selectedSrv = servers.find(s => s.id === srvId);
    if (selectedSrv && selectedSrv.features.length > 0) {
      setSimFeature(selectedSrv.features[0].name);
    } else {
      setSimFeature('');
    }
  };

  // Launch simulated check-out or release
  const handleCheckoutSimulate = async (action: 'checkout' | 'release') => {
    if (!simServer || !simFeature) return;
    setSimulationLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/checkouts/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          serverId: simServer,
          featureName: simFeature,
          username: simUser,
          hostname: simHost,
          project: simProj,
          action
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Checkout simulation error occurred');
      }

      setTerminalMsg(`[CONSOLE_LOG] FlexLM vendor response syntax code 200:
Checkout authorization success on Feature '${simFeature}'.
Status: ${action === 'checkout' ? 'GRANTED' : 'RELEASED'}
Target Node: ${simHost} | Project: ${simProj}
Reticulated licensing status correctly.`);

      // Sync and reload lists
      fetchDashboardData();
      onRefreshServers();
    } catch (err: any) {
      setTerminalMsg(`[FLEX_ERROR] Status code 403:
${err.message || 'Licensing threshold boundary exhausted.'}`);
    } finally {
      setSimulationLoading(false);
    }
  };

  // Handle priority license preemption
  const handlePreemptSimulator = async (chkToPreempt: Checkout) => {
    if (currentUser.role === 'Engineer') {
      alert('Unauthorized. Only Admins and Lead Managers can force license preemptions.');
      return;
    }
    setPreemptionLoading(true);
    try {
      // Find matching server ID for this checkout
      const targetServer = servers.find(s => s.features.some(f => f.name === chkToPreempt.featureName && f.checkouts.some(c => c.id === chkToPreempt.id)));
      if (!targetServer) {
        throw new Error('Associated licensing server not found');
      }

      const response = await fetch(`${apiHost}/api/preempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          serverId: targetServer.id,
          featureName: chkToPreempt.featureName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Preemption triggering failed');
      }

      setTerminalMsg(`[PREEMPTION_ALERT] Forced signal preempted:
SIGSTOP instructions transmitted to user '${data.preemptedUser}'.
Granted layout slot reserved to requester profile '${data.targetUser}'.
Audit logs registered.`);

      fetchDashboardData();
      onRefreshServers();
    } catch (err: any) {
      alert(`Preemption block: ${err.message}`);
    } finally {
      setPreemptionLoading(false);
    }
  };

  // Memoized filters for UI counts and graphs
  const filteredServers = React.useMemo(() => {
    return servers.filter(srv => {
      const matchServer = selectedServerFilter === 'all' || srv.id === selectedServerFilter;
      const matchVendor = selectedVendorFilter === 'all' || srv.type === selectedVendorFilter;
      return matchServer && matchVendor;
    });
  }, [servers, selectedServerFilter, selectedVendorFilter]);

  const filteredOnlineServers = React.useMemo(() => {
    return filteredServers.filter(s => s.status === 'online');
  }, [filteredServers]);

  const filteredCheckouts = React.useMemo(() => {
    return checkouts.filter(chk => {
      const hostingServer = servers.find(s => s.id === (chk as any).serverId || s.features.some(f => f.name === chk.featureName));
      if (!hostingServer) return true;
      
      const matchServer = selectedServerFilter === 'all' || hostingServer.id === selectedServerFilter;
      const matchVendor = selectedVendorFilter === 'all' || hostingServer.type === selectedVendorFilter;
      return matchServer && matchVendor;
    });
  }, [checkouts, servers, selectedServerFilter, selectedVendorFilter]);

  // Searches on active checkouts (e.g. Users using feature search, or features used by a user search)
  const searchedAndFilteredCheckouts = React.useMemo(() => {
    return filteredCheckouts.filter(chk => {
      const matchUser = !searchUsername || chk.username.toLowerCase().includes(searchUsername.toLowerCase());
      const matchFeature = !searchFeatureName || chk.featureName.toLowerCase().includes(searchFeatureName.toLowerCase());
      return matchUser && matchFeature;
    });
  }, [filteredCheckouts, searchUsername, searchFeatureName]);

  const filteredTotalLicCount = React.useMemo(() => {
    return filteredServers.reduce((acc, curr) => acc + (curr.status === 'online' ? curr.totalLicenses : 0), 0);
  }, [filteredServers]);

  const filteredTotalUsedCount = React.useMemo(() => {
    return filteredServers.reduce((acc, curr) => acc + (curr.status === 'online' ? curr.usedLicenses : 0), 0);
  }, [filteredServers]);

  const filteredUtilizationRate = React.useMemo(() => {
    return filteredTotalLicCount > 0 ? Math.round((filteredTotalUsedCount / filteredTotalLicCount) * 100) : 0;
  }, [filteredTotalLicCount, filteredTotalUsedCount]);

  // Reactive compilation of total historic usage records based on the server/vendor options selections
  const filteredUsageStats = React.useMemo(() => {
    if (!usageStats || !usageStats.records) return null;
    
    const records = usageStats.records.filter((r: any) => {
      const hostingServer = servers.find(s => s.features.some(f => f.name === r.featureName));
      if (!hostingServer) return true;
      
      const matchServer = selectedServerFilter === 'all' || hostingServer.id === selectedServerFilter;
      const matchVendor = selectedVendorFilter === 'all' || hostingServer.type === selectedVendorFilter;
      return matchServer && matchVendor;
    });

    const byDate: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    const byProject: Record<string, number> = {};

    records.forEach((r: any) => {
      byDate[r.date] = (byDate[r.date] || 0) + r.durationHours;
      byUser[r.username] = (byUser[r.username] || 0) + r.durationHours;
      byFeature[r.featureName] = (byFeature[r.featureName] || 0) + r.durationHours;
      if (r.project) byProject[r.project] = (byProject[r.project] || 0) + r.durationHours;
    });

    return {
      records,
      aggregations: {
        byDate,
        byUser,
        byFeature,
        byProject
      }
    };
  }, [usageStats, servers, selectedServerFilter, selectedVendorFilter]);

  // Convert chart records data to scannable chart input array format
  const getTrendData = () => {
    if (!filteredUsageStats || !filteredUsageStats.aggregations?.byDate) return [];
    return Object.entries(filteredUsageStats.aggregations.byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10) // past 10 points
      .map(([date, hours]) => {
        // Convert date like YYYY-MM-DD to Month Day
        const [, m, d] = date.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[parseInt(m) - 1]} ${d}`;
        return { name: label, hours };
      });
  };

  const getUserDistributionData = () => {
    if (!filteredUsageStats || !filteredUsageStats.aggregations?.byUser) return [];
    return Object.entries(filteredUsageStats.aggregations.byUser)
      .map(([user, hours]) => ({ name: user, 'Usage (Hrs)': hours }))
      .sort((a, b) => (b['Usage (Hrs)'] as number) - (a['Usage (Hrs)'] as number))
      .slice(0, 5); // top 5
  };

  const getFeatureDistributionData = () => {
    if (!filteredUsageStats || !filteredUsageStats.aggregations?.byFeature) return [];
    return Object.entries(filteredUsageStats.aggregations.byFeature)
      .map(([feature, hours]) => ({ name: feature, Hours: hours }))
      .sort((a, b) => (b.Hours as number) - (a.Hours as number))
      .slice(0, 5); // top 5
  };

  const onlineServersCount = filteredOnlineServers.length;
  const offlineCount = filteredServers.length - onlineServersCount;
  const totalLicCount = filteredTotalLicCount;
  const totalUsedCount = filteredTotalUsedCount;
  const utilizationRate = filteredUtilizationRate;

  return (
    <div className="space-y-6">
      {/* Telemetry Cluster & Daemon Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-blue-650" />
          <span className="font-semibold text-slate-705 text-xs uppercase tracking-wider">Cluster Telemetry Filter Panel</span>
        </div>
        <div className="flex flex-wrap gap-4 items-center animate-fade-in">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Server:</span>
            <select
              id="selectedServerFilter"
              value={selectedServerFilter}
              onChange={(e) => setSelectedServerFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2.5 py-1 text-xs font-semibold cursor-pointer hover:bg-slate-100 transition focus:outline-none"
            >
              <option value="all">⚡ All Server Nodes</option>
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Vendor Daemon:</span>
            <select
              id="selectedVendorFilter"
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2.5 py-1 text-xs font-semibold cursor-pointer hover:bg-slate-100 transition focus:outline-none"
            >
              <option value="all">🛠️ All Vendor Daemons</option>
              <option value="cadence">Cadence Daemon (cadence)</option>
              <option value="synopsys">Synopsys Daemon (synopsys)</option>
              <option value="mentor">Mentor Graphics Daemon (mentor)</option>
              <option value="other">Generic Other Daemon (other)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1. Statistics Cards Block */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">License Servers</span>
            <h2 className="text-3xl font-bold mt-1 text-slate-800">{filteredServers.length}</h2>
          </div>
          <div className="flex items-center text-emerald-600 text-xs mt-4 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
            {onlineServersCount} Active / Online
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Active Checkouts</span>
            <h2 className="text-3xl font-bold mt-1 text-slate-800">{filteredCheckouts.length}</h2>
          </div>
          <div className="flex items-center text-slate-500 text-xs mt-4 font-medium">
            Active workstation processes
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Total Pool Capacity</span>
            <h2 className="text-3xl font-bold mt-1 text-blue-600">
              {totalUsedCount} <span className="text-slate-300">/</span> {totalLicCount}
            </h2>
          </div>
          <div className="flex items-center text-slate-400 text-xs mt-4 font-medium">
            Optimized across cluster sites
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Utilization Density</span>
            <h2 className="text-3xl font-bold mt-1 text-orange-500">{utilizationRate}%</h2>
          </div>
          <div className="flex items-center text-slate-400 text-xs mt-4 font-medium">
            Cluster capability load factor
          </div>
        </div>
      </div>

      {/* 2. Visualizations Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-display font-semibold text-slate-800 text-sm mb-4 uppercase tracking-wider">
            Total Hourly Utilization Trend (Active Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getTrendData()} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" name="Hours Used" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-display font-semibold text-slate-800 text-sm mb-4 uppercase tracking-wider">
            Top Users & Top CAD Features Consumption
          </h3>
          <div className="grid grid-cols-2 gap-4 h-64">
            <div className="h-full">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1.5 text-center">Engineers by Hours</span>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={getUserDistributionData()} margin={{ left: -30, right: 5 }}>
                  <XAxis dataKey="name" fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="Usage (Hrs)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-full">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase mb-1.5 text-center">Top Licensed Modules</span>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={getFeatureDistributionData()} margin={{ left: -30, right: 5 }}>
                  <XAxis dataKey="name" fontSize={8} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="Hours" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Terminal Emulator & Simulation Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700 flex flex-col p-5 text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
            <h3 className="font-bold text-white text-sm">Quick Server Simulator</h3>
            <span className="px-2 py-0.5 bg-green-905/40 text-green-400 text-[9px] rounded-full border border-green-800 uppercase font-mono">GLOBAL READY</span>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Acquire and release temporary licenses instantly on simulated node workstations to test option rules blockages.
          </p>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Target License Server</label>
              <select
                value={simServer}
                onChange={(e) => handleServerChange(e.target.value)}
                className="w-full bg-slate-700 border-none text-white text-xs rounded p-2.5 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {servers.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-805 text-white">{s.name} ({s.status})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Module / Feature</label>
              <select
                value={simFeature}
                onChange={(e) => setSimFeature(e.target.value)}
                className="w-full bg-slate-700 border-none text-white text-xs rounded p-2.5 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                disabled={!simServer}
              >
                <option value="" className="bg-slate-805 text-white">-- Choose feature --</option>
                {servers.find(s => s.id === simServer)?.features.map(f => (
                  <option key={f.id} value={f.name} className="bg-slate-805 text-white">{f.name} ({f.used}/{f.total} used)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">User Identifier</label>
                <input
                  type="text"
                  value={simUser}
                  onChange={(e) => setSimUser(e.target.value)}
                  className="w-full bg-slate-705 text-white border-none rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Workstation Node</label>
                <input
                  type="text"
                  value={simHost}
                  onChange={(e) => setSimHost(e.target.value)}
                  className="w-full bg-slate-705 text-white border-none rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <button
              onClick={() => handleCheckoutSimulate('checkout')}
              disabled={simulationLoading || !simFeature}
              className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-2.5 rounded border border-blue-500 transition-colors flex flex-col items-center justify-center cursor-pointer disabled:opacity-40"
            >
              <span>Acquire</span>
              <span className="text-[8px] font-normal text-blue-200">Simulate Checkout</span>
            </button>
            <button
              onClick={() => handleCheckoutSimulate('release')}
              disabled={simulationLoading || !simFeature}
              className="bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold py-2.5 rounded border border-slate-600 transition-colors flex flex-col items-center justify-center cursor-pointer disabled:opacity-40"
            >
              <span>Release</span>
              <span className="text-[8px] font-normal text-slate-400">Return Module</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col h-[340px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-slate-300 font-mono">console://sysadmin@flexlm-daemon</span>
            </div>
            <div className="flex space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-805" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-805" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-805" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-[11px] text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
              {terminalMsg}
            </pre>
          </div>
        </div>
      </div>

      {/* 4. Active Checkouts and Preemption Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-fade-in text-slate-800">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50/50 gap-3">
          <div>
            <h3 className="font-bold text-slate-700 flex items-center text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse mt-0.5"></span>
              Live Checkout Tracking Console
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Track in real-time which users hold specific feature licenses</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="text-[10.5px] bg-white border border-slate-200 px-3 py-1.5 rounded shadow-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 focus:outline-none"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh Nodes
            </button>
          </div>
        </div>

        {/* Dynamic Bidirectional Search Blocks */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-slate-400">Search Features used by User</label>
            <div className="relative">
              <input
                id="searchUsername"
                type="text"
                placeholder="Enter Username (e.g. chen_w, alex_k)..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchUsername && (
                <button
                  type="button"
                  onClick={() => setSearchUsername('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold focus:outline-none"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-slate-400">Search Users using a Feature</label>
            <div className="relative">
              <input
                id="searchFeatureName"
                type="text"
                placeholder="Enter Feature Module (e.g. icc2, prime_time)..."
                value={searchFeatureName}
                onChange={(e) => setSearchFeatureName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchFeatureName && (
                <button
                  type="button"
                  onClick={() => setSearchFeatureName('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold focus:outline-none"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {searchedAndFilteredCheckouts.length === 0 ? (
          <div className="border-t border-slate-100 p-12 text-center text-slate-400 text-xs font-medium">
            No active licenses checkouts matching current search criteria found. Use the EDA Simulator to spin checkouts!
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3">User/Developer</th>
                  <th className="px-4 py-3">Workstation Host</th>
                  <th className="px-4 py-3">Feature Module</th>
                  <th className="px-4 py-3">Server Cluster</th>
                  <th className="px-4 py-3">Checkout Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchedAndFilteredCheckouts.map((chk, idx) => (
                  <tr key={chk.id || idx} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 flex items-center">
                      <div className="w-6 h-6 rounded bg-slate-100 text-[10px] font-bold flex items-center justify-center mr-2 text-slate-605">
                        {chk.username ? chk.username.slice(0, 2).toUpperCase() : 'AS'}
                      </div>
                      <span className="font-semibold text-slate-700">{chk.username}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {chk.hostname}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 font-semibold rounded font-mono text-[10px]">
                        {chk.featureName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">
                      {(chk as any).serverName || 'EDA License Cluster'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {new Date(chk.checkoutTime).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currentUser.role !== 'Engineer' && chk.username !== currentUser.username ? (
                        <button
                          type="button"
                          onClick={() => handlePreemptSimulator(chk)}
                          disabled={preemptionLoading}
                          className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1 rounded shadow-sm font-semibold transition cursor-pointer focus:outline-none"
                        >
                          lmremove / Revoke
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">No overrides</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
