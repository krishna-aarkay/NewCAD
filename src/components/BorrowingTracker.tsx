import React, { useState, useEffect } from 'react';
import { Calendar, Check, X, ShieldAlert, Cpu, ArrowDownCircle, RefreshCw, AlertTriangle, Play, Info } from 'lucide-react';
import { BorrowRecord, LicenseServer, UserProfile } from '../types';

interface BorrowingTrackerProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
  onRefreshData: () => void;
}

export default function BorrowingTracker({ apiHost, currentUser, servers, onRefreshData }: BorrowingTrackerProps) {
  const [borrowList, setBorrowList] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [handling, setHandling] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New borrow Form state
  const [selectedFeature, setSelectedFeature] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [targetHost, setTargetHost] = useState(currentUser.host || 'node-offline');
  const [borrowReason, setBorrowReason] = useState('');
  const [preemptionPriority, setPreemptionPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [targetProj, setTargetProj] = useState(currentUser.project || 'Project_Apollo');

  const filteredBorrows = borrowList.filter((rec) => {
    if (statusFilter === 'all') return true;
    return rec.status.toLowerCase() === statusFilter.toLowerCase();
  });

  useEffect(() => {
    fetchBorrows();
  }, []);

  const fetchBorrows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/borrow`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setBorrowList(data.borrows || []);
    } catch (err) {
      console.error('Error fetching borrow entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBorrowRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeature || !borrowReason) {
      alert('Feature selection and justification details are required.');
      return;
    }

    try {
      const res = await fetch(`${apiHost}/api/borrow/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          featureName: selectedFeature,
          durationDays: parseInt(durationDays) || 7,
          host: targetHost,
          reason: borrowReason,
          project: targetProj,
          preemptionPriority
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed requesting borrow');
      }

      const data = await res.json();
      setSelectedFeature('');
      setBorrowReason('');

      if (data.preemptionExecuted) {
        alert(`Instant High-Priority Preemption Succeeded!\n\nAll license slots were fully saturated. The preemption engine revoked lower-priority user '${data.oustedUser}' and automatically checked out ${selectedFeature} offline on workstation ${targetHost}.`);
      } else if (data.borrow && data.borrow.status === 'borrowed') {
        alert(`Offline License Fulfill Success!\n\nFree slot was acquired. License feature ${selectedFeature} approved and checked out instantly.`);
      } else {
        alert('Offline license borrow request submitted successfully! Prior authentication pending.');
      }

      fetchBorrows();
      onRefreshData();
    } catch (err: any) {
      alert(`Borrow filing block: ${err.message}`);
    }
  };

  const handleAuthorizeDecision = async (id: string, status: 'authorized' | 'rejected') => {
    setHandling(id);
    try {
      const res = await fetch(`${apiHost}/api/borrow/${id}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Authorization status transition failed');

      alert(`Request has been ${status === 'authorized' ? 'approved & keys checked out offline' : 'rejected'}.`);
      fetchBorrows();
      onRefreshData();
    } catch (err: any) {
      alert(`Authorize failed: ${err.message}`);
    } finally {
      setHandling(null);
    }
  };

  const handleReturnBorrow = async (id: string) => {
    setHandling(id);
    try {
      const res = await fetch(`${apiHost}/api/borrow/${id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        }
      });

      if (!res.ok) throw new Error('Return transaction rejected by coordinator');

      alert('Offline keys returned early! Checked coordinates back into license pool licensing table.');
      fetchBorrows();
      onRefreshData();
    } catch (err: any) {
      alert(`Return failed: ${err.message}`);
    } finally {
      setHandling(null);
    }
  };

  // Compile list of unique features across servers for selection dropdown
  const allFeatures: string[] = [];
  servers.forEach(s => {
    s.features.forEach(f => {
      if (!allFeatures.includes(f.name)) {
        allFeatures.push(f.name);
      }
    });
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'borrowed': return 'bg-blue-50 border border-blue-100 text-blue-700 font-semibold';
      case 'pending': return 'bg-amber-50 border border-amber-100 text-amber-700 font-medium';
      case 'returned': return 'bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium';
      case 'rejected': return 'bg-slate-100 border border-slate-200 text-slate-500 font-medium';
      case 'preempted': return 'bg-rose-50 border border-rose-100 text-rose-700 font-semibold';
      default: return 'bg-slate-50 border border-slate-200 text-slate-600';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-rose-50 text-rose-700 font-bold';
      case 'medium': return 'bg-amber-50 text-amber-700';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Borrow Form column */}
      <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between text-left">
        <form onSubmit={handleSubmitBorrowRequest} className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Calendar className="w-5 text-blue-500" />
            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">Filing Borrow offline</h3>
              <p className="text-[11px] text-slate-500">Acquire licensing locks offline on client machines for prior authorized intervals.</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Select Licensed Feature</label>
              <select
                value={selectedFeature}
                onChange={(e) => setSelectedFeature(e.target.value)}
                required
                className="w-full px-3 py-1.5 border border-slate-300 text-slate-900 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose feature --</option>
                {allFeatures.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Interval Days</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 text-slate-900 rounded-lg text-xs"
                >
                  <option value="3">3 Days (short-term)</option>
                  <option value="7">7 Days (weekly checkout)</option>
                  <option value="14">14 Days (max block limit)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Preemption Priority</label>
                <select
                  value={preemptionPriority}
                  onChange={(e) => setPreemptionPriority(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-300 text-slate-900 rounded-lg text-xs"
                >
                  <option value="low">Low (highly preemptible)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (un-preemptible)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Target Client Workstation</label>
                <input
                  type="text"
                  required
                  value={targetHost}
                  onChange={(e) => setTargetHost(e.target.value)}
                  placeholder="node-offline"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Project Code</label>
                <input
                  type="text"
                  value={targetProj}
                  onChange={(e) => setTargetProj(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Offline justification & verification reasons</label>
              <textarea
                rows={4}
                required
                value={borrowReason}
                onChange={(e) => setBorrowReason(e.target.value)}
                placeholder="Describe why offline locks are essential (e.g., home compilation, customer facility mapping testBed, etc.)"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold uppercase tracking-wide cursor-pointer transition mt-4"
          >
            Filing for prior authentication
          </button>
        </form>
      </div>

      {/* Trailing List Column */}
      <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between text-left">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
            <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-400" /> Offline Borrows authorizations ledger ({filteredBorrows.length})
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="borrowed">Borrowed</option>
                <option value="returned">Returned</option>
                <option value="preempted">Preempted</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={fetchBorrows}
                disabled={loading}
                className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Sync Borrows
              </button>
            </div>
          </div>

          {filteredBorrows.length === 0 ? (
            <div className="p-12 border border-dashed text-center text-slate-400 rounded-lg text-xs">
              {borrowList.length === 0 
                ? "No borrowing records filed inside system registers yet. Add a borrow application on the left form."
                : "No borrowing records match the selected status filter."}
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {filteredBorrows.map((rec) => {
                const isOwner = rec.username === currentUser.username;
                const canGovern = currentUser.role === 'Admin' || currentUser.role === 'Manager';

                return (
                  <div key={rec.id} className="p-4 bg-slate-50 border border-slate-150 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{rec.username}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="font-mono text-[11px] font-bold text-slate-600">{rec.featureName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${getStatusStyle(rec.status)}`}>
                          {rec.status.toUpperCase()}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono capitalize ${getPriorityStyle(rec.preemptionPriority)}`}>
                          Prio: {rec.preemptionPriority}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono">
                        Host: {rec.host} | project: {rec.project || 'Apollo'} | days: {rec.durationDays}
                      </div>

                      <p className="text-[11px] text-slate-600 italic bg-white p-1.5 px-2 rounded-md border border-slate-100 mt-1 max-w-xl">
                        &ldquo;{rec.reason}&rdquo;
                      </p>

                      {rec.status === 'borrowed' && (
                        <div className="text-[10px] text-amber-600 flex items-center gap-1 font-mono pt-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Returns limit checkpoint: {new Date(rec.limitTime).toLocaleDateString()}</span>
                        </div>
                      )}

                      {rec.approvedBy && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Handled by: <span className="font-semibold">{rec.approvedBy}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {/* Standard approval flow for lead levels */}
                      {rec.status === 'pending' && canGovern && (
                        <>
                          <button
                            onClick={() => handleAuthorizeDecision(rec.id, 'authorized')}
                            disabled={handling === rec.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 px-2.5 rounded font-semibold text-xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleAuthorizeDecision(rec.id, 'rejected')}
                            disabled={handling === rec.id}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1 px-2.5 rounded font-medium text-xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}

                      {/* Returns logic for active borrower */}
                      {rec.status === 'borrowed' && (isOwner || canGovern) && (
                        <button
                          onClick={() => handleReturnBorrow(rec.id)}
                          disabled={handling === rec.id}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-semibold text-xs cursor-pointer flex items-center gap-1 transition"
                        >
                          <ArrowDownCircle className="w-3.5 h-3.5 text-indigo-500" />
                          Return keys
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3.5 bg-blue-50 border border-blue-105 rounded-lg flex items-start gap-2 text-xs text-blue-700 leading-relaxed mt-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5 animate-bounce" />
          <span>
            <strong>Preemption priority logic:</strong> Borrowing applications marked as <strong className="text-rose-700 font-bold uppercase">High</strong> priority represent locked licensing cells. High requests can override lower-prio active checkout processes immediately if total pools are fully saturated.
          </span>
        </div>
      </div>
    </div>
  );
}
