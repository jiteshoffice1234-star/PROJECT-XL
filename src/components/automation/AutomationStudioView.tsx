import React, { useState } from 'react';
import { AutomationRule, AuditLogEntry, SheetData } from '../../types';
import {
  Zap,
  Plus,
  PlayCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Sparkles,
  Layers,
  ArrowRight,
  History,
} from 'lucide-react';

interface AutomationStudioViewProps {
  automations: AutomationRule[];
  auditLogs: AuditLogEntry[];
  sheets: SheetData[];
  onAddAutomation: (rule: Omit<AutomationRule, 'id'>) => void;
  onToggleAutomation: (id: string) => void;
  onDeleteAutomation: (id: string) => void;
  onClearAuditLogs: () => void;
}

export const AutomationStudioView: React.FC<AutomationStudioViewProps> = ({
  automations,
  auditLogs,
  sheets,
  onAddAutomation,
  onToggleAutomation,
  onDeleteAutomation,
  onClearAuditLogs,
}) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');

  // Form states for visual builder
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState<AutomationRule['trigger']>('on_party_entered');
  const [condField, setCondField] = useState('PARTY');
  const [condOperator, setCondOperator] = useState<'equals' | 'contains' | 'starts_with' | 'not_empty'>('not_empty');
  const [condValue, setCondValue] = useState('');
  const [actionType, setActionType] = useState<AutomationRule['action']['type']>('set_instruction');
  const [actionTargetCol, setActionTargetCol] = useState('col_6');
  const [actionValue, setActionValue] = useState('');
  const [targetSheetId, setTargetSheetId] = useState('all');
  const [priority, setPriority] = useState(1);
  const [ruleDesc, setRuleDesc] = useState('');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    onAddAutomation({
      name: ruleName.trim(),
      trigger: ruleTrigger,
      conditions: [
        {
          field: condField,
          operator: condOperator,
          value: condValue,
        },
      ],
      action: {
        type: actionType,
        targetColumn: actionTargetCol,
        value: actionValue,
      },
      targetSheetId,
      priority: Number(priority),
      enabled: true,
      description: ruleDesc.trim() || undefined,
    });

    setIsBuilderOpen(false);
    setRuleName('');
    setCondValue('');
    setRuleDesc('');
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-neutral-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Zap className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Automation Studio</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Build event-driven rules, auto-fill workflows, and real-time triggers for spreadsheets.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-neutral-900 border border-neutral-800 p-0.5 rounded-lg flex items-center text-xs">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'rules' ? 'bg-cyan-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Active Automations ({automations.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'history' ? 'bg-cyan-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Execution History ({auditLogs.length})
            </button>
          </div>

          <button
            onClick={() => setIsBuilderOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Automation</span>
          </button>
        </div>
      </div>

      {activeTab === 'rules' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {automations.map((auto) => (
              <div
                key={auto.id}
                className={`bg-neutral-900 border rounded-xl p-4 flex flex-col justify-between transition ${
                  auto.enabled ? 'border-neutral-800 hover:border-neutral-700' : 'border-neutral-800/40 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-amber-300 font-semibold uppercase">
                      {auto.trigger.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onToggleAutomation(auto.id)}
                        title={auto.enabled ? 'Disable automation' : 'Enable automation'}
                      >
                        {auto.enabled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-neutral-600" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete automation "${auto.name}"?`)) {
                            onDeleteAutomation(auto.id);
                          }
                        }}
                        title="Delete automation"
                        className="text-neutral-500 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">{auto.name}</h3>
                  <p className="text-xs text-neutral-400 mb-3">{auto.description || 'No description provided'}</p>

                  {/* Conditions & Actions Visual Flow */}
                  <div className="space-y-2 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80 text-[11px] font-mono">
                    <div className="flex items-center space-x-1.5 text-neutral-300">
                      <span className="text-amber-400 font-bold uppercase">WHEN:</span>
                      <span>{auto.conditions.map((c) => `${c.field} ${c.operator} ${c.value || '""'}`).join(' AND ')}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-cyan-400">
                      <span className="text-cyan-500 font-bold uppercase">THEN:</span>
                      <span>
                        {auto.action.type === 'set_instruction'
                          ? 'Lookup & Populate INSTRUCTIONS'
                          : auto.action.type === 'set_status'
                          ? `Set Status to "${auto.action.value}"`
                          : auto.action.type === 'set_cell'
                          ? `Update Column to "${auto.action.value}"`
                          : auto.action.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Priority: P{auto.priority}</span>
                  <span>Target: {auto.targetSheetId === 'all' ? 'All Sheets' : 'Active Sheet'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Execution Audit Log Tab */
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-md">
          <div className="p-3 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-neutral-200">Real-Time Action Log</span>
            </div>
            <button
              onClick={onClearAuditLogs}
              className="text-[11px] text-neutral-400 hover:text-rose-400 transition"
            >
              Clear Logs
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">No automation events recorded yet.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 text-[10px] uppercase font-mono border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4">Sheet</th>
                    <th className="py-2.5 px-4">Coordinates</th>
                    <th className="py-2.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/30">
                      <td className="py-2 px-4 font-mono text-[11px] text-neutral-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                            log.source === 'automation'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
                              : log.source === 'lookup'
                              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {log.source}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-neutral-300">{log.sheetName}</td>
                      <td className="py-2 px-4 font-mono text-cyan-400">{log.cellCoord}</td>
                      <td className="py-2 px-4 text-neutral-200">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Visual Rule Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Create Visual Automation Rule</h3>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Flag Surat Dispatch Orders"
                  className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Trigger Event</label>
                <select
                  value={ruleTrigger}
                  onChange={(e) => setRuleTrigger(e.target.value as any)}
                  className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-amber-500 outline-none"
                >
                  <option value="on_party_entered">When Party Name is Entered</option>
                  <option value="on_cell_edit">When Any Cell is Edited</option>
                  <option value="on_status_changed">When REMARK / Status Changes</option>
                  <option value="on_row_added">When a New Row is Created</option>
                  <option value="on_duplicate">When Duplicate Data is Detected</option>
                </select>
              </div>

              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase">Condition (WHEN)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Field / Column</label>
                    <input
                      type="text"
                      value={condField}
                      onChange={(e) => setCondField(e.target.value)}
                      placeholder="e.g. PARTY or SELLER"
                      className="w-full bg-neutral-900 text-white px-2 py-1 text-xs border border-neutral-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Operator</label>
                    <select
                      value={condOperator}
                      onChange={(e) => setCondOperator(e.target.value as any)}
                      className="w-full bg-neutral-900 text-white px-2 py-1 text-xs border border-neutral-700 rounded"
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts With</option>
                      <option value="not_empty">Is Not Empty</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Value</label>
                    <input
                      type="text"
                      value={condValue}
                      onChange={(e) => setCondValue(e.target.value)}
                      placeholder="e.g. AKSHAT"
                      className="w-full bg-neutral-900 text-white px-2 py-1 text-xs border border-neutral-700 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
                <span className="text-[11px] font-bold text-cyan-400 uppercase">Action (THEN)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Action Type</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as any)}
                      className="w-full bg-neutral-900 text-white px-2 py-1 text-xs border border-neutral-700 rounded"
                    >
                      <option value="set_instruction">Auto-Populate Instruction</option>
                      <option value="set_status">Set REMARK / Status</option>
                      <option value="set_cell">Set Cell Value</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 block mb-0.5">Value / Parameter</label>
                    <input
                      type="text"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder="e.g. PRINT or R3181"
                      className="w-full bg-neutral-900 text-white px-2 py-1 text-xs border border-neutral-700 rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">Target Sheet</label>
                  <select
                    value={targetSheetId}
                    onChange={(e) => setTargetSheetId(e.target.value)}
                    className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded outline-none"
                  >
                    <option value="all">All Sheets</option>
                    {sheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">Priority</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium shadow-md transition"
                >
                  Save Automation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
