import React, { useState, useEffect } from 'react';
import { AlertCircle, ShieldCheck, HelpCircle, Terminal, RefreshCw, Cpu, BrainCircuit, HeartCrack, Info } from 'lucide-react';
import { LicenseComplianceIssue, LicenseServer, UserProfile } from '../types';
import ReactMarkdown from 'react-markdown';

interface ComplianceViewerProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
}

export default function ComplianceViewer({ apiHost, currentUser, servers }: ComplianceViewerProps) {
  const [issues, setIssues] = useState<LicenseComplianceIssue[]>([]);
  const [auditing, setAuditing] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [geminiAdvice, setGeminiAdvice] = useState<string>('');

  useEffect(() => {
    fetchComplianceIssues();
  }, []);

  const fetchComplianceIssues = async () => {
    try {
      const res = await fetch(`${apiHost}/api/compliance`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setIssues(data.compliance || []);
    } catch (err) {
      console.error('Error fetching compliance findings:', err);
    }
  };

  const handleTriggerAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch(`${apiHost}/api/compliance/audit`, {
        method: 'POST',
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setIssues(data.compliance || []);
      alert('Continuous compliance audit scan finished successfully across all features registries!');
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setAuditing(false);
    }
  };

  const handleResolveIssue = async (id: string) => {
    if (currentUser.role !== 'Admin') {
      alert('Only administrators are authorized to remove audit findings.');
      return;
    }
    try {
      const res = await fetch(`${apiHost}/api/compliance/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.username }
      });
      if (res.ok) {
        setIssues(issues.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error('Resolve issue error:', err);
    }
  };

  // Invoke server proxy to query Gemini for option file optimization advice
  const handleQueryGeminiAdvise = async () => {
    setLoadingAdvice(true);
    setGeminiAdvice('');
    try {
      // Collect current warnings to feed advisor context
      const miniLogs = issues.map(i => ({ type: i.type, severity: i.severity, message: i.message }));
      const optionContent = servers.map(s => `Server ${s.name} Options:\n${s.optionsFileContent || ''}`).join('\n\n');

      const res = await fetch(`${apiHost}/api/gemini/compliance-optimization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({
          consoleLogs: miniLogs,
          optionContent
        })
      });

      const data = await res.json();
      setGeminiAdvice(data.advice || 'Advisor could not generate advice at this moment.');
    } catch (err: any) {
      setGeminiAdvice(`### 🤖 Heuristic Fallback advice:
An error occurred while contacting the Gemini AI analyzer module: ${err.message}.

Please ensure that your FlexLM options syntaxes are correctly aligned, and that your reservation ratios are kept below 30% of total pool capacities to prevent starving general queues.`);
    } finally {
      setLoadingAdvice(false);
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical': return 'border-l-4 border-l-rose-500 bg-rose-50/50';
      case 'warning': return 'border-l-4 border-l-amber-500 bg-amber-50/50';
      default: return 'border-l-4 border-l-sky-500 bg-sky-50/50';
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return <HeartCrack className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />;
      default: return <Info className="w-5 h-5 text-sky-500 shrink-0" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
      {/* List of active warnings */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-5 text-emerald-500" /> License Compliance & Audit Registry ({issues.length})
            </h3>
            <button
              onClick={handleTriggerAudit}
              disabled={auditing}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditing ? 'animate-spin' : ''}`} /> Run Compliance Sweep
            </button>
          </div>

          <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
            {issues.length === 0 ? (
              <div className="p-12 border border-dashed text-center text-slate-400 rounded-lg text-xs">
                Perfect compliance status! No active warnings, overcheckouts, or borrow violations reported.
              </div>
            ) : (
              issues.map((i) => (
                <div key={i.id} className={`p-4 rounded-lg border border-slate-150 flex items-start gap-3.5 justify-between ${getSeverityStyle(i.severity)}`}>
                  <div className="flex gap-2.5 items-start">
                    {getSeverityIcon(i.severity)}
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {i.type.replace('_', ' ')} • {new Date(i.timestamp).toLocaleTimeString()}
                      </span>
                      <h4 className="font-semibold text-slate-900 text-xs">{i.message}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">{i.details}</p>
                    </div>
                  </div>

                  {currentUser.role === 'Admin' && (
                    <button
                      onClick={() => handleResolveIssue(i.id)}
                      className="p-1 text-xs text-slate-400 hover:text-rose-500 font-semibold cursor-pointer shrink-0"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed mt-4">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>Continuous inspections track approaching keys expiry deadlines, offline borrowing validation metrics, and unauthorized workstation blocks.</span>
        </div>
      </div>

      {/* Gemini AI Optimization Advisor box */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5">
              <BrainCircuit className="w-5 text-indigo-500" />
              <div>
                <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">Gemini Compliance Advisor</h3>
                <p className="text-[11px] text-slate-500">Leverage AI to analyze warning logs & generate optimized options file structures.</p>
              </div>
            </div>
            
            <button
              onClick={handleQueryGeminiAdvise}
              disabled={loadingAdvice}
              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1"
            >
              {loadingAdvice ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyzing Configurations...
                </>
              ) : (
                'Generate Smart Audit'
              )}
            </button>
          </div>

          <div className="min-h-72 p-4 bg-slate-50 text-slate-800 rounded-xl border border-slate-150 overflow-y-auto max-h-[460px]">
            {geminiAdvice ? (
              <div className="markdown-body text-xs leading-relaxed max-w-none">
                <ReactMarkdown>{geminiAdvice}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center text-slate-400 flex flex-col items-center justify-center p-12 h-64 gap-3">
                <BrainCircuit className="w-12 h-12 text-slate-300 animate-pulse" />
                <span className="font-semibold text-slate-600 font-display">No smart audit report generated</span>
                <p className="text-[11px] text-slate-400 max-w-sm">Click the top-right button. Gemini will audit your active FlexLM options configurations and generate optimizing advice for includes/excludes and preemption settings.</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center leading-normal mt-4">Audits are processed server-side using the google-genai package environment ruleset. No client key exposure.</div>
      </div>
    </div>
  );
}
