import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Check, RefreshCw, FileText, Settings, Key, Info, HelpCircle } from 'lucide-react';
import { LicenseServer, OptionsRule, UserProfile } from '../types';

interface OptionsManagerProps {
  apiHost: string;
  currentUser: UserProfile;
  servers: LicenseServer[];
  onRefreshData: () => void;
}

export default function OptionsManager({ apiHost, currentUser, servers, onRefreshData }: OptionsManagerProps) {
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [optionsFileText, setOptionsFileText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [rereading, setRereading] = useState(false);

  // Structured rules building states
  const [rules, setRules] = useState<OptionsRule[]>([]);
  const [groups, setGroups] = useState<Record<string, string[]>>({
    'IC_DESIGN_LEAD': ['admin', 'chen_w'],
    'PHYSICAL_DV': ['alex_k'],
    'DFT_TEAM': ['meera_s']
  });

  // Individual rule creator state
  const [newType, setNewType] = useState<'RESERVE' | 'EXCLUDE' | 'INCLUDE' | 'PREEMPT' | 'PRIORITY'>('RESERVE');
  const [newCount, setNewCount] = useState<number>(5);
  const [newPriority, setNewPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newFeature, setNewFeature] = useState<string>('');
  const [newGroupType, setNewGroupType] = useState<'USER' | 'HOST' | 'INTERNET' | 'PROJECT'>('USER');
  const [newGroupName, setNewGroupName] = useState<string>('');

  // Group creator state
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [newGroupUsers, setNewGroupUsers] = useState('');

  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers]);

  useEffect(() => {
    if (selectedServerId) {
      fetchOptionsFile();
    }
  }, [selectedServerId]);

  const fetchOptionsFile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiHost}/api/servers/${selectedServerId}/options-file`, {
        headers: { 'x-user-id': currentUser.username }
      });
      const data = await res.json();
      setOptionsFileText(data.content || '');
    } catch (err) {
      console.error('Error fetching options file content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTextOptions = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`${apiHost}/api/servers/${selectedServerId}/options-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ content: optionsFileText })
      });

      if (!res.ok) throw new Error('Failed to update options text');
      
      alert('FlexLM options file saved successfully!');
      onRefreshData();
    } catch (err: any) {
      alert(`Error saving options file: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddStructuredRule = () => {
    if (!newFeature || !newGroupName) {
      alert('Key feature name and targets are required.');
      return;
    }

    const rule: OptionsRule = {
      id: `rule-${Date.now()}`,
      type: newType,
      count: newType === 'RESERVE' ? newCount : (newType === 'PRIORITY' ? (newPriority === 'HIGH' ? 3 : newPriority === 'MEDIUM' ? 2 : 1) : undefined),
      feature: newFeature.trim(),
      groupType: newGroupType,
      groupName: newGroupName.trim()
    };

    setRules([...rules, rule]);
    setNewFeature('');
    setNewGroupName('');
  };

  const handleRemoveStructuredRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleAddGroup = () => {
    if (!newGroupNameInput || !newGroupUsers) {
      alert('Group name and user list are required');
      return;
    }
    const userArr = newGroupUsers.split(',').map(u => u.trim());
    setGroups({
      ...groups,
      [newGroupNameInput.trim().toUpperCase()]: userArr
    });
    setNewGroupNameInput('');
    setNewGroupUsers('');
  };

  const handleRemoveGroup = (gName: string) => {
    const updated = { ...groups };
    delete updated[gName];
    setGroups(updated);
  };

  // Compile structured compiler and upload
  const handleCompileRules = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`${apiHost}/api/servers/${selectedServerId}/options-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ rules, groups })
      });

      if (!res.ok) throw new Error('Structure compiler reported an error');
      
      const data = await res.json();
      setOptionsFileText(data.content);
      
      alert('Rules built and compiled into options file text content!');
      onRefreshData();
    } catch (err: any) {
      alert(`Compilation failure: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleTriggerLmreread = async () => {
    setRereading(true);
    try {
      const res = await fetch(`${apiHost}/api/servers/${selectedServerId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.username
        },
        body: JSON.stringify({ action: 'lmreread' })
      });

      if (!res.ok) throw new Error('Lmreread command process exited with fault status');
      
      alert('Command LMREREAD completed! Daemon parsed the options rules changes.');
      onRefreshData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setRereading(false);
    }
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
      {/* Structural Options builder panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-5">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <Settings className="w-5 text-blue-500" />
          <div>
            <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">Options file UI Builder</h3>
            <p className="text-[11px] text-slate-500">Enable reservations, exclusion restrictions, includes, and user groups safely without writing code.</p>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Target Licensing Pool</label>
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 text-slate-900 rounded-lg text-xs"
          >
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
            ))}
          </select>
        </div>

        {/* 1. Define Groups */}
        <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-lg space-y-3">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Group Declarations</span>
          
          <div className="space-y-2">
            {Object.entries(groups).map(([gName, users]) => (
              <div key={gName} className="flex justify-between items-center text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-md">
                <div>
                  <span className="font-semibold text-slate-800 font-mono">{gName}</span>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Users: {users.join(', ')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveGroup(gName)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <input
              type="text"
              placeholder="GROUP_NAME"
              value={newGroupNameInput}
              onChange={(e) => setNewGroupNameInput(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
            />
            <input
              type="text"
              placeholder="user1, user2, user3"
              value={newGroupUsers}
              onChange={(e) => setNewGroupUsers(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleAddGroup}
            className="w-full py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-xs cursor-pointer"
          >
            Declare Group
          </button>
        </div>

        {/* 2. Setup RESERVE / INCLUDE / EXCLUDE */}
        <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-lg space-y-3.5">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Reservation & Exclusion Rules</span>

          {rules.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {rules.map((rule) => (
                <div key={rule.id} className="flex justify-between items-center text-xs bg-white border border-slate-200 px-3 py-2 rounded-md">
                  <div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold mr-1.5 ${
                      rule.type === 'RESERVE' ? 'bg-blue-50 text-blue-600' : 
                      rule.type === 'EXCLUDE' ? 'bg-rose-100 text-rose-700' : 
                      rule.type === 'INCLUDE' ? 'bg-emerald-50 text-emerald-700' :
                      rule.type === 'PRIORITY' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {rule.type}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-800">{rule.feature}</span>
                    <span className="text-[10px] text-slate-400 mx-2">to</span>
                    <span className="font-mono text-[11px]">{rule.groupType}: <span className="font-semibold text-slate-600">{rule.groupName}</span></span>
                    {rule.type === 'RESERVE' && rule.count !== undefined && <span className="ml-1.5 text-[9px] font-semibold text-amber-600">({rule.count} keys)</span>}
                    {rule.type === 'PRIORITY' && rule.count !== undefined && <span className="ml-1.5 text-[9px] font-semibold text-indigo-600">({rule.count === 3 ? 'HIGH' : rule.count === 2 ? 'MEDIUM' : 'LOW'} priority)</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStructuredRule(rule.id)}
                    className="text-slate-400 hover:text-red-500 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Rule Strategy Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="RESERVE">RESERVE (allocate keys)</option>
                  <option value="EXCLUDE">EXCLUDE (block list)</option>
                  <option value="INCLUDE">INCLUDE (white list)</option>
                  <option value="PRIORITY">PRIORITY (set queue priority)</option>
                  <option value="PREEMPT">PREEMPT (enable preemptions)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Scope Target</label>
                <select
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value as any)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="USER">USER (individual Name)</option>
                  <option value="HOST">HOST (Discrete node)</option>
                  <option value="INTERNET">INTERNET (IP / Network Subnet)</option>
                  <option value="PROJECT">PROJECT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {newType === 'RESERVE' ? (
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Reserved Keys Count</label>
                  <input
                    type="number"
                    min={1}
                    value={newCount}
                    onChange={(e) => setNewCount(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              ) : newType === 'PRIORITY' ? (
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                  >
                    <option value="HIGH">HIGH (Immediate queue access)</option>
                    <option value="MEDIUM">MEDIUM (Standard load balance)</option>
                    <option value="LOW">LOW (Preemption targets)</option>
                  </select>
                </div>
              ) : null}

              <div className={(newType !== 'RESERVE' && newType !== 'PRIORITY') ? 'col-span-2' : ''}>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Feature Name</label>
                <select
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                >
                  <option value="">-- select module --</option>
                  {selectedServer?.features.map(f => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Target Value</label>
              <input
                type="text"
                placeholder="e.g. IC_DESIGN_LEAD, alex_k or 192.168.10.*"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleAddStructuredRule}
              className="w-full py-1 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-xs cursor-pointer"
            >
              Add rule item
            </button>
          </div>
        </div>

        <button
          onClick={handleCompileRules}
          disabled={updating || rules.length === 0}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition cursor-pointer disabled:opacity-50"
        >
          {updating ? 'Compiling structures...' : 'Compile Structures & Propagate Options'}
        </button>
      </div>

      {/* Compiler output editor panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <FileText className="w-5 text-indigo-500" />
            <div>
              <h3 className="font-display font-semibold text-slate-900 text-sm uppercase tracking-wider">Compiled Options Terminal</h3>
              <p className="text-[11px] text-slate-500">Physical FlexLM .opt text syntax. Verify compiled characters or update directly.</p>
            </div>
          </div>

          <div>
            <textarea
              rows={15}
              value={optionsFileText}
              onChange={(e) => setOptionsFileText(e.target.value)}
              className="w-full p-3 bg-slate-900 text-amber-400 font-mono text-xs rounded-xl border border-slate-700 leading-relaxed focus:outline-none"
              placeholder="# FlexLM Options file"
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2 text-xs text-blue-700 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Note on FlexLM behavior:</strong> Options modifications require executing an <code className="bg-white/60 px-1 py-0.5 rounded">lmreread</code> command or daemon power-cycle to read modifications. Use the direct actions triggers below.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-5 border-t border-slate-100 mt-4">
          <button
            onClick={handleSaveTextOptions}
            disabled={updating || loading}
            className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition"
          >
            Save Options file
          </button>
          <button
            onClick={handleTriggerLmreread}
            disabled={rereading || loading}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rereading ? 'animate-spin' : ''}`} />
            Trigger LMREREAD
          </button>
        </div>
      </div>
    </div>
  );
}
