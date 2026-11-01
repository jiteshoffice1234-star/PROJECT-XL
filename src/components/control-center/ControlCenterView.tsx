import React, { useState, useMemo } from 'react';
import { PartyRule } from '../../types';
import { lookupPartyInstruction, normalizePartyName } from '../../utils/ruleEngine';
import {
  Plus,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  AlertTriangle,
  Play,
  ShieldCheck,
  Tag,
  History,
} from 'lucide-react';

interface ControlCenterViewProps {
  partyRules: PartyRule[];
  onAddRule: (rule: Omit<PartyRule, 'id' | 'updatedAt'>) => void;
  onUpdateRule: (id: string, updates: Partial<PartyRule>) => void;
  onDeleteRule: (id: string) => void;
  onToggleRule: (id: string) => void;
}

export const ControlCenterView: React.FC<ControlCenterViewProps> = ({
  partyRules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PartyRule | null>(null);

  // Simulator state
  const [testParty, setTestParty] = useState('RATNA JEWELS');
  const [testSeller, setTestSeller] = useState('AKSHAT');

  // Form state
  const [formPartyName, setFormPartyName] = useState('');
  const [formSellerCond, setFormSellerCond] = useState('');
  const [formInstruction, setFormInstruction] = useState('');
  const [formPriority, setFormPriority] = useState(5);
  const [formAliases, setFormAliases] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Simulator result
  const testResult = useMemo(() => {
    return lookupPartyInstruction(testParty, testSeller, partyRules);
  }, [testParty, testSeller, partyRules]);

  // Unique sellers for filter
  const uniqueSellers = useMemo(() => {
    const set = new Set<string>();
    partyRules.forEach((r) => {
      if (r.sellerCondition) set.add(r.sellerCondition);
    });
    return Array.from(set);
  }, [partyRules]);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return partyRules.filter((r) => {
      const matchSearch =
        r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.instruction.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.aliases && r.aliases.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchSeller = !filterSeller || (r.sellerCondition && r.sellerCondition.toLowerCase() === filterSeller.toLowerCase());
      return matchSearch && matchSeller;
    });
  }, [partyRules, searchTerm, filterSeller]);

  // Duplicate party detection
  const duplicateParties = useMemo(() => {
    const map = new Map<string, number>();
    partyRules.forEach((r) => {
      const key = `${normalizePartyName(r.partyName)}___${(r.sellerCondition || '').toUpperCase()}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const dups = new Set<string>();
    map.forEach((count, key) => {
      if (count > 1) dups.add(key.split('___')[0]);
    });
    return dups;
  }, [partyRules]);

  const openAddModal = () => {
    setEditingRule(null);
    setFormPartyName('');
    setFormSellerCond('');
    setFormInstruction('');
    setFormPriority(5);
    setFormAliases('');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (rule: PartyRule) => {
    setEditingRule(rule);
    setFormPartyName(rule.partyName);
    setFormSellerCond(rule.sellerCondition || '');
    setFormInstruction(rule.instruction);
    setFormPriority(rule.priority || 5);
    setFormAliases((rule.aliases || []).join(', '));
    setFormNotes(rule.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPartyName.trim() || !formInstruction.trim()) return;

    const aliases = formAliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (editingRule) {
      onUpdateRule(editingRule.id, {
        partyName: formPartyName.trim(),
        sellerCondition: formSellerCond.trim() || undefined,
        instruction: formInstruction.trim(),
        priority: Number(formPriority),
        aliases,
        notes: formNotes.trim(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      onAddRule({
        partyName: formPartyName.trim(),
        sellerCondition: formSellerCond.trim() || undefined,
        instruction: formInstruction.trim(),
        priority: Number(formPriority),
        enabled: true,
        aliases,
        notes: formNotes.trim(),
      });
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 overflow-y-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-neutral-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Intelligent Control Center</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Central repository for Party Names, multi-condition Seller routing rules, and auto-lookup instructions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Party Rule</span>
          </button>
        </div>
      </div>

      {/* Simulator Card: Interactive lookup tester */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <Play className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Live Instruction Lookup Simulator</h2>
          <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-full font-mono">
            Active Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">Test Party Name</label>
            <input
              type="text"
              value={testParty}
              onChange={(e) => setTestParty(e.target.value)}
              placeholder="e.g. RATNA JEWELS"
              className="w-full bg-neutral-950 text-white px-3 py-1.5 text-xs border border-neutral-700 rounded-md focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Test Seller Name (Optional condition)
            </label>
            <input
              type="text"
              value={testSeller}
              onChange={(e) => setTestSeller(e.target.value)}
              placeholder="e.g. AKSHAT or RUSHIKESH"
              className="w-full bg-neutral-950 text-white px-3 py-1.5 text-xs border border-neutral-700 rounded-md focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-neutral-500 block uppercase font-mono">Resolved Instruction</span>
              <span className={`text-sm font-bold font-mono ${testResult.found ? 'text-cyan-400' : 'text-neutral-500'}`}>
                {testResult.found ? testResult.instruction : '(No rule configured)'}
              </span>
            </div>
            {testResult.found && (
              <span className="text-[10px] px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">
                {testResult.conditionMatched}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate warning notification if any duplicate party names have conflict */}
      {duplicateParties.size > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-3 flex items-center space-x-3 text-xs text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold">Multiple rules detected for: </span>
            {Array.from(duplicateParties).join(', ')}. Rules are evaluated strictly by priority and seller condition.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party names, instructions, aliases..."
            className="w-full bg-neutral-950 text-neutral-200 pl-9 pr-3 py-1.5 text-xs border border-neutral-800 rounded-md focus:border-cyan-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={filterSeller}
            onChange={(e) => setFilterSeller(e.target.value)}
            className="bg-neutral-950 text-neutral-300 px-3 py-1.5 text-xs border border-neutral-800 rounded-md focus:border-cyan-500 outline-none"
          >
            <option value="">All Sellers</option>
            {uniqueSellers.map((s) => (
              <option key={s} value={s}>
                Seller: {s}
              </option>
            ))}
          </select>

          <span className="text-xs text-neutral-500 font-mono">
            {filteredRules.length} of {partyRules.length} rules
          </span>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-950/80 text-neutral-400 border-b border-neutral-800 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Party Name</th>
                <th className="py-3 px-4">Seller Condition</th>
                <th className="py-3 px-4">Instruction</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Aliases</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-neutral-800/40 transition">
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => onToggleRule(rule.id)}
                      title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                      className="flex items-center space-x-1"
                    >
                      {rule.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-neutral-600" />
                      )}
                    </button>
                  </td>

                  <td className="py-2.5 px-4 font-semibold text-white">
                    <div className="flex items-center space-x-2">
                      <span>{rule.partyName}</span>
                      {duplicateParties.has(normalizePartyName(rule.partyName)) && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950/70 text-cyan-300 border border-cyan-800/50 rounded font-mono">
                          Conditional
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-4 font-mono">
                    {rule.sellerCondition ? (
                      <span className="px-2 py-0.5 bg-neutral-800 text-cyan-300 border border-neutral-700 rounded text-[11px]">
                        Seller == {rule.sellerCondition}
                      </span>
                    ) : (
                      <span className="text-neutral-500">(Any Seller / Default)</span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">
                    <span className="px-2 py-1 bg-neutral-950 border border-cyan-900/40 rounded">
                      {rule.instruction}
                    </span>
                  </td>

                  <td className="py-2.5 px-4 font-mono text-neutral-300">
                    <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-[10px]">P{rule.priority}</span>
                  </td>

                  <td className="py-2.5 px-4 text-neutral-400">
                    {rule.aliases && rule.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {rule.aliases.map((alias) => (
                          <span key={alias} className="text-[10px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
                            {alias}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-600">-</span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 text-neutral-400 max-w-xs truncate" title={rule.notes}>
                    {rule.notes || <span className="text-neutral-600">-</span>}
                  </td>

                  <td className="py-2.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(rule)}
                      title="Edit rule"
                      className="p-1 text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800 rounded transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete instruction rule for "${rule.partyName}"?`)) {
                          onDeleteRule(rule.id);
                        }
                      }}
                      title="Delete rule"
                      className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {editingRule ? `Edit Rule: ${editingRule.partyName}` : 'Add New Control Center Party Rule'}
            </h3>

            <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  value={formPartyName}
                  onChange={(e) => setFormPartyName(e.target.value)}
                  placeholder="e.g. RATNA JEWELS"
                  className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">
                    Seller Condition <span className="text-neutral-500">(Leave empty for default)</span>
                  </label>
                  <input
                    type="text"
                    value={formSellerCond}
                    onChange={(e) => setFormSellerCond(e.target.value)}
                    placeholder="e.g. AKSHAT or RUSHIKESH"
                    className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-medium mb-1">Priority (1 = Highest)</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Target Instruction *</label>
                <input
                  type="text"
                  required
                  value={formInstruction}
                  onChange={(e) => setFormInstruction(e.target.value)}
                  placeholder="e.g. R3181, HOLD FOR PAYMENT, E-WAY BILL REQUIRED"
                  className="w-full bg-neutral-950 text-cyan-300 font-mono font-bold px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Aliases (Comma separated)</label>
                <input
                  type="text"
                  value={formAliases}
                  onChange={(e) => setFormAliases(e.target.value)}
                  placeholder="e.g. RATNA, RATNA JEWELLERS, RATNA J."
                  className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Surat dispatch instruction with tracking number"
                  className="w-full bg-neutral-950 text-white px-3 py-1.5 border border-neutral-700 rounded focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow-md transition"
                >
                  {editingRule ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
