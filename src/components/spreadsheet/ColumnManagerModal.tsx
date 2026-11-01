import React, { useState } from 'react';
import { SheetData, ColumnDef } from '../../types';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Columns, Edit2, Check } from 'lucide-react';

interface ColumnManagerModalProps {
  isOpen: boolean;
  sheet: SheetData;
  onClose: () => void;
  onAddColumn: (name: string, type: ColumnDef['type'], width: number) => void;
  onRenameColumn: (colId: string, newName: string) => void;
  onDeleteColumn: (colId: string) => void;
  onReorderColumns: (fromIdx: number, toIdx: number) => void;
}

export const ColumnManagerModal: React.FC<ColumnManagerModalProps> = ({
  isOpen,
  sheet,
  onClose,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  onReorderColumns,
}) => {
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnDef['type']>('text');
  const [newColWidth, setNewColWidth] = useState(150);

  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onAddColumn(newColName.trim().toUpperCase(), newColType, Number(newColWidth));
    setNewColName('');
  };

  const handleStartRename = (col: ColumnDef) => {
    setEditingColId(col.id);
    setEditingColName(col.name);
  };

  const handleSaveRename = (colId: string) => {
    if (editingColName.trim()) {
      onRenameColumn(colId, editingColName.trim().toUpperCase());
    }
    setEditingColId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Columns className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Manage Columns for "{sheet.name}"</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Add New Column Form */}
          <form onSubmit={handleAdd} className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Add New Custom Column (e.g. BROKER)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Column Name (e.g. BROKER)"
                  className="w-full bg-neutral-900 text-white px-3 py-1.5 text-xs border border-neutral-700 rounded outline-none focus:border-cyan-500 font-semibold"
                />
              </div>
              <div>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as any)}
                  className="w-full bg-neutral-900 text-white px-2 py-1.5 text-xs border border-neutral-700 rounded outline-none"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Column</span>
            </button>
          </form>

          {/* Existing Columns List */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-400 block">Existing Columns ({sheet.columns.length})</span>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {sheet.columns.map((col, idx) => (
                <div
                  key={col.id}
                  className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-xs"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-[10px] font-mono text-neutral-500 w-5">{idx + 1}</span>

                    {editingColId === col.id ? (
                      <div className="flex items-center space-x-1 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingColName}
                          onChange={(e) => setEditingColName(e.target.value)}
                          className="bg-neutral-900 text-white px-2 py-0.5 text-xs border border-cyan-500 rounded outline-none flex-1 font-semibold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(col.id)}
                          className="p-1 text-emerald-400 hover:bg-neutral-800 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="font-semibold text-white">{col.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-neutral-800 text-neutral-400 rounded font-mono">
                          {col.type || 'text'}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">{col.width}px</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleStartRename(col)}
                      title="Rename column"
                      className="p-1 text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === 0}
                      onClick={() => onReorderColumns(idx, idx - 1)}
                      title="Move left"
                      className="p-1 disabled:opacity-30 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === sheet.columns.length - 1}
                      onClick={() => onReorderColumns(idx, idx + 1)}
                      title="Move right"
                      className="p-1 disabled:opacity-30 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {sheet.columns.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete column "${col.name}"? Data in this column will be removed.`)) {
                            onDeleteColumn(col.id);
                          }
                        }}
                        title="Delete column"
                        className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
