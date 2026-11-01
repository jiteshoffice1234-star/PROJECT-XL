import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  PaintBucket,
  PlusSquare,
  Trash2,
  ArrowUpDown,
  Search,
  Volume2,
  CheckCircle2,
  Save,
  SlidersHorizontal,
  TableProperties,
} from 'lucide-react';

interface SpreadsheetToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onFormatStyle: (style: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; bg?: string; color?: string }) => void;
  onInsertRow: (position: 'above' | 'below') => void;
  onDeleteRow: () => void;
  onAddColumn: () => void;
  onDeleteColumn: () => void;
  onSortColumn: (direction: 'asc' | 'desc') => void;
  onOpenSearch: () => void;
  onSaveManual: () => void;
  onSpeakSelection: () => void;
  onManageColumns: () => void;
  saveStatus: 'saved' | 'saving' | 'error';
}

const COLOR_PALETTE = [
  'transparent',
  '#FEF3C7', // amber (Pending)
  '#DBEAFE', // blue (Print)
  '#EDE9FE', // purple (Backdated)
  '#D1FAE5', // emerald (Uploaded)
  '#FEE2E2', // rose (Cancellation)
  '#E0E7FF', // indigo
  '#F3F4F6', // light gray
  '#1E293B', // dark slate
];

export const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFormatStyle,
  onInsertRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onSortColumn,
  onOpenSearch,
  onSaveManual,
  onSpeakSelection,
  onManageColumns,
  saveStatus,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="flex items-center justify-between h-10 px-3 bg-neutral-900 border-b border-neutral-800 text-neutral-300 text-xs select-none overflow-x-auto">
      {/* Left tool group */}
      <div className="flex items-center space-x-1">
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className={`p-1.5 rounded transition ${
            canUndo ? 'hover:bg-neutral-800 text-neutral-200' : 'text-neutral-600 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className={`p-1.5 rounded transition ${
            canRedo ? 'hover:bg-neutral-800 text-neutral-200' : 'text-neutral-600 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Clipboard */}
        <button onClick={onCut} title="Cut (Ctrl+X)" className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200">
          <Scissors className="w-4 h-4" />
        </button>
        <button onClick={onCopy} title="Copy (Ctrl+C)" className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={onPaste} title="Paste (Ctrl+V)" className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200">
          <Clipboard className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Styling */}
        <button
          onClick={() => onFormatStyle({ bold: true })}
          title="Bold"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200 font-bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => onFormatStyle({ italic: true })}
          title="Italic"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200 italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        {/* Alignment */}
        <button
          onClick={() => onFormatStyle({ align: 'left' })}
          title="Align Left"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onFormatStyle({ align: 'center' })}
          title="Align Center"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => onFormatStyle({ align: 'right' })}
          title="Align Right"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        {/* Background Color Picker */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Cell Fill Color"
            className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200 flex items-center space-x-1"
          >
            <PaintBucket className="w-4 h-4 text-cyan-400" />
          </button>
          {showColorPicker && (
            <div className="absolute left-0 top-8 z-50 p-2 bg-neutral-900 border border-neutral-700 rounded shadow-xl grid grid-cols-3 gap-1.5 w-32">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onFormatStyle({ bg: color === 'transparent' ? undefined : color });
                    setShowColorPicker(false);
                  }}
                  className="w-7 h-7 rounded border border-neutral-600 hover:scale-110 transition flex items-center justify-center"
                  style={{ backgroundColor: color === 'transparent' ? '#18181b' : color }}
                  title={color === 'transparent' ? 'No color' : color}
                >
                  {color === 'transparent' && <span className="text-[10px] text-neutral-400">∅</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Rows & Columns Actions */}
        <button
          onClick={() => onInsertRow('below')}
          title="Insert Row Below"
          className="px-2 py-1 hover:bg-neutral-800 rounded transition text-neutral-200 flex items-center space-x-1"
        >
          <PlusSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Row</span>
        </button>
        <button
          onClick={onDeleteRow}
          title="Delete Selected Row"
          className="p-1.5 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 rounded transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onAddColumn}
          title="Add Custom Column (e.g. BROKER)"
          className="px-2 py-1 hover:bg-neutral-800 rounded transition text-neutral-200 flex items-center space-x-1"
        >
          <TableProperties className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">+ Col</span>
        </button>

        <button
          onClick={onManageColumns}
          title="Manage & Reorder Columns"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-300"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

        {/* Sort & Search */}
        <button
          onClick={() => onSortColumn('asc')}
          title="Sort Ascending (A-Z)"
          className="p-1.5 hover:bg-neutral-800 rounded transition text-neutral-200"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onOpenSearch}
          title="Global Search (Ctrl+K)"
          className="px-2 py-1 hover:bg-neutral-800 rounded transition text-neutral-200 flex items-center space-x-1 border border-neutral-700/60"
        >
          <Search className="w-3 h-3 text-cyan-400" />
          <span className="text-[11px] text-neutral-400">Search</span>
          <kbd className="text-[9px] bg-neutral-800 px-1 py-0.5 rounded text-neutral-400">⌘K</kbd>
        </button>

        {/* Speak row via TTS */}
        <button
          onClick={onSpeakSelection}
          title="Speak Selected Cell/Row (Gemini TTS)"
          className="px-2 py-1 hover:bg-cyan-950/40 rounded transition text-cyan-300 flex items-center space-x-1 border border-cyan-800/50"
        >
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline text-[11px]">TTS Voice</span>
        </button>
      </div>

      {/* Right status group */}
      <div className="flex items-center space-x-3">
        {/* Save Status & Button */}
        <button
          onClick={onSaveManual}
          title="Save now (Ctrl+S)"
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 transition"
        >
          {saveStatus === 'saving' ? (
            <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          ) : saveStatus === 'saved' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Save className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className="text-[11px] font-medium">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Error'}
          </span>
        </button>
      </div>
    </div>
  );
};
