import React, { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { FileDown, Calendar, Search, RefreshCw, BarChart3, Filter, Hourglass, Coins } from 'lucide-react';
import { LicenseServer, UsageRecord, UserProfile } from '../types';

interface ReportsViewProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
}

export default function ReportsView({ apiHost, currentUser, servers }: ReportsViewProps) {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [aggregations, setAggregations] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 3600000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterFeature, setFilterFeature] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterUser, setFilterUser] = useState('');

  // Trends state
  const [trendsAggregation, setTrendsAggregation] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [trendsProject, setTrendsProject] = useState<string>('all');

  // Feature usage chart project state
  const [featureUsageProject, setFeatureUsageProject] = useState<string>('all');

  useEffect(() => {
    fetchUsageReports();
  }, [startDate, endDate, filterFeature, filterProject, filterUser]);

  const fetchUsageReports = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        startDate,
        endDate,
        feature: filterFeature,
        project: filterProject,
        username: filterUser
      });

      const res = await fetch(`${apiHost}/api/reports/usage?${qParams.toString()}`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setRecords(data.records || []);
      setAggregations(data.aggregations || {});
    } catch (err) {
      console.error('Error fetching usage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    // Generate actual file download download link with filters
    const qParams = new URLSearchParams({
      startDate,
      endDate,
      feature: filterFeature,
      project: filterProject,
      username: filterUser
    });
    window.open(`${apiHost}/api/reports/export?${qParams.toString()}`);
  };

  // Compile unique lists of filters from servers database
  const featuresList: string[] = [];
  servers.forEach(s => {
    s.features.forEach(f => {
      if (!featuresList.includes(f.name)) featuresList.push(f.name);
    });
  });

  const uniqueProjects = ['Project_Apollo', 'Project_Zephyr', 'Project_Titan', 'Internal_Core'];

  const dynamicProjects = React.useMemo(() => {
    const list = new Set(uniqueProjects);
    records.forEach(r => {
      if (r.project) list.add(r.project);
    });
    return Array.from(list);
  }, [records, uniqueProjects]);

  // Total accumulators
  const totalHours = records.reduce((acc, curr) => acc + curr.durationHours, 0);
  const totalTokens = records.reduce((acc, curr) => acc + (curr.tokensUsed || curr.durationHours * 10), 0);
  const uniqueUsersCount = new Set(records.map(r => r.username)).size;

  // Chart data preparing
  const getTimelineChartData = () => {
    if (!aggregations?.byDate) return [];
    return Object.entries(aggregations.byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => {
        const [, m, d] = date.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return {
          name: `${monthNames[parseInt(m) - 1]} ${d}`,
          Hours: hours
        };
      });
  };

  const getUserChartData = () => {
    if (!aggregations?.byUser) return [];
    return Object.entries(aggregations.byUser)
      .map(([user, hours]) => ({ name: user, Hours: hours }))
      .sort((a, b) => (b.Hours as number) - (a.Hours as number));
  };

  const getProjChartData = () => {
    if (!aggregations?.byProject) return [];
    return Object.entries(aggregations.byProject)
      .map(([proj, hours]) => ({ name: proj, Hours: hours }))
      .sort((a, b) => (b.Hours as number) - (a.Hours as number));
  };

  const getFeatureUsageChartData = () => {
    const counts: { [feature: string]: number } = {};
    records.forEach(rec => {
      if (featureUsageProject !== 'all' && rec.project !== featureUsageProject) {
        return;
      }
      const feat = rec.featureName || 'Unknown Feature';
      counts[feat] = (counts[feat] || 0) + rec.durationHours;
    });

    return Object.entries(counts)
      .map(([name, hours]) => ({
        name,
        Hours: parseFloat(hours.toFixed(1))
      }))
      .sort((a, b) => b.Hours - a.Hours);
  };

  const COLOR_PALETTE = [
    '#4f46e5', // indigo
    '#ec4899', // pink
    '#10b981', // emerald
    '#f97316', // orange
    '#06b6d4', // cyan
    '#a855f7', // purple
    '#ef4444', // red
    '#3b82f6', // blue
    '#eab308'  // yellow
  ];

  const getTrendChartData = () => {
    // Filter records by local trendsProject if selected
    const filtered = records.filter(rec => {
      if (trendsProject === 'all') return true;
      return rec.project === trendsProject;
    });

    const getGroupKey = (dateStr: string) => {
      if (!dateStr) return 'Unknown';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      if (trendsAggregation === 'daily') {
        return dateStr;
      } else if (trendsAggregation === 'weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day;
        const sunday = new Date(date.setDate(diff));
        return `W/C ${sunday.toISOString().split('T')[0]}`;
      } else {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      }
    };

    const groups: { [key: string]: { [feature: string]: number } } = {};
    const featuresSet = new Set<string>();

    filtered.forEach(rec => {
      const key = getGroupKey(rec.date);
      const feat = rec.featureName || 'Unknown Feature';
      featuresSet.add(feat);

      if (!groups[key]) {
        groups[key] = {};
      }
      groups[key][feat] = (groups[key][feat] || 0) + rec.durationHours;
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      let keyA = a.startsWith('W/C ') ? a.substring(4) : a;
      let keyB = b.startsWith('W/C ') ? b.substring(4) : b;
      
      if (trendsAggregation === 'monthly') {
        const parseMonthYear = (str: string) => {
          const parts = str.split(' ');
          if (parts.length < 2) return 0;
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const mIdx = monthNames.indexOf(parts[0]);
          return new Date(parseInt(parts[1]), mIdx, 1).getTime();
        };
        return parseMonthYear(keyA) - parseMonthYear(keyB);
      }

      return new Date(keyA).getTime() - new Date(keyB).getTime();
    });

    const data = sortedKeys.map(key => {
      const featureSums = groups[key];
      const totalHours = Object.values(featureSums).reduce((s, v) => s + v, 0);
      return {
        period: key,
        Total: parseFloat(totalHours.toFixed(1)),
        ...Object.fromEntries(
          Object.entries(featureSums).map(([f, hrs]) => [f, parseFloat(hrs.toFixed(1))])
        )
      };
    });

    return {
      data,
      features: Array.from(featuresSet)
    };
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. Filtering block */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="font-display font-semibold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" /> Usage Records Custom aggregation filters
          </h3>
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="p-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" /> Export to CSV
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Feature Name</label>
            <select
              value={filterFeature}
              onChange={(e) => setFilterFeature(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none"
            >
              <option value="">-- All --</option>
              {featuresList.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Project Code</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none"
            >
              <option value="">-- All --</option>
              {uniqueProjects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Workstation User</label>
            <input
              type="text"
              placeholder="e.g. alex_k"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 2. Highlight aggregations indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total consumption Hrs</span>
            <span className="text-xl font-bold font-display text-slate-900">{totalHours} Hours</span>
          </div>
          <Hourglass className="w-8 h-8 text-indigo-500/10" />
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tokens consumed</span>
            <span className="text-xl font-bold font-display text-slate-900">{totalTokens} Tokens</span>
          </div>
          <Coins className="w-8 h-8 text-amber-500/10" />
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Unique active handles</span>
            <span className="text-xl font-bold font-display text-slate-900">{uniqueUsersCount} Developers</span>
          </div>
          <BarChart3 className="w-8 h-8 text-emerald-500/10" />
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Aggregated Records count</span>
            <span className="text-xl font-bold font-display text-slate-900">{records.length} Check-ins</span>
          </div>
          <RefreshCw className="w-8 h-8 text-purple-500/10" />
        </div>
      </div>

      {/* 3. Charts details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200">
          <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider mb-4">Daily Licensing Hours Usage Timeline</h4>
          {getTimelineChartData().length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">No records to plot.</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getTimelineChartData()} margin={{ left: -25, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                  <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Hours" stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} dot={true} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider mb-4">Primary Projects Distribution</h4>
            {getProjChartData().length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">No projects data.</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getProjChartData()} margin={{ left: -30, right: 5 }}>
                    <XAxis dataKey="name" fontSize={9} tickLine={false} stroke="#94a3b8" />
                    <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                    <Tooltip />
                    <Bar dataKey="Hours" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 text-center leading-relaxed mt-4">Calculated weekly and monthly based on token lock signals registered inside flexlm log parser.</p>
        </div>
      </div>

      {/* 3.0.5 License Feature Usage Breakdown */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
          <div>
            <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-600" /> Feature-Specific Hours Breakdown
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono uppercase">Total licensing hours consumed per module with project-level sorting</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter by Project:</span>
            <select
              value={featureUsageProject}
              onChange={(e) => setFeatureUsageProject(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">-- All Projects --</option>
              {dynamicProjects.map(proj => (
                <option key={proj} value={proj}>{proj.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {getFeatureUsageChartData().length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No active usage registered for the selected project filter.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getFeatureUsageChartData()} margin={{ left: -15, right: 15, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                  <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} label={{ value: 'Total Hours', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', offset: 0 }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(value: any) => [`${value} hrs`, 'Usage Hours']} />
                  <Bar dataKey="Hours" radius={[4, 4, 0, 0]}>
                    {getFeatureUsageChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-3 uppercase tracking-wider">
              <span>Selected Project Code: <strong className="text-slate-700">{featureUsageProject === 'all' ? 'All Combined' : featureUsageProject}</strong></span>
              <span>•</span>
              <span>Matching Target Modules: <strong className="text-slate-700">{getFeatureUsageChartData().length} active features</strong></span>
              <span>•</span>
              <span>Total Consumption: <strong className="text-slate-700">{getFeatureUsageChartData().reduce((sum, item) => sum + item.Hours, 0).toFixed(1)} hrs</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 3.1 Advanced License Usage Trends (Multi-Feature & Period-Aggregated) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
          <div>
            <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-650" /> License Usage Trends By Feature & Period
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono uppercase">Multi-feature consumption hours aggregated over customizable intervals</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <label className="sr-only">Aggregation Level</label>
              <select
                value={trendsAggregation}
                onChange={(e) => setTrendsAggregation(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-750 text-xs font-semibold rounded-lg cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="daily">Daily View</option>
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
              </select>
            </div>
            
            <div>
              <label className="sr-only">Project Filter</label>
              <select
                value={trendsProject}
                onChange={(e) => setTrendsProject(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-755 text-xs font-semibold rounded-lg cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                {uniqueProjects.map(proj => (
                  <option key={proj} value={proj}>{proj}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {getTrendChartData().data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No records match the selected project filter inside current date constraints.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getTrendChartData().data} margin={{ left: -15, right: 15, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" fontSize={11} stroke="#94a3b8" tickLine={false} />
                  <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', offset: 0 }} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {getTrendChartData().features.map((feat, index) => (
                    <Line
                      key={feat}
                      type="monotone"
                      dataKey={feat}
                      name={feat}
                      stroke={COLOR_PALETTE[index % COLOR_PALETTE.length]}
                      strokeWidth={2.5}
                      activeDot={{ r: 6 }}
                      dot={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-3 uppercase tracking-wider">
              <span>Selected Segment Hours: <strong className="text-slate-700">{getTrendChartData().data.reduce((sum, item) => sum + item.Total, 0).toFixed(1)} hrs</strong></span>
              <span>•</span>
              <span>Active Features: <strong className="text-slate-700">{getTrendChartData().features.length} modules</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Table records review logs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h4 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider mb-4">Detailed historic check-ins archive</h4>
        
        {records.length === 0 ? (
          <div className="p-8 border border-dashed text-center text-xs text-slate-400 rounded-lg">No parsed logs match current filtration criteria.</div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">User ID</th>
                  <th className="py-2 px-3">Feature module</th>
                  <th className="py-2 px-3">Duration Hours</th>
                  <th className="py-2 px-3">Billing Project</th>
                  <th className="py-2 px-3">Tokens Metric</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(-50).reverse().map((rec) => (
                  <tr key={rec.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-500">{rec.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{rec.username}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-600">{rec.featureName}</td>
                    <td className="py-2.5 px-3">{rec.durationHours} hrs</td>
                    <td className="py-2.5 px-3 text-slate-500">{rec.project || 'Apollo'}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{rec.tokensUsed || rec.durationHours * 10} TK</td>
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
