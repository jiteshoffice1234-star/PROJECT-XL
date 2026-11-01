import React, { useState } from 'react';
import { SheetData, SelectionRange } from '../../types';
import { Plus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MoreVertical } from 'lucide-react';

interface SheetTabsBarProps {
  sheets: SheetData[];
  activeSheetId: string;
  selection: SelectionRange | null;
  activeCell: { colIdx: number; rowIdx: number };
  zoom: number;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, newName: string) => void;
  onDuplicateSheet: (id: string) => void;
  onDeleteSheet: (id: string) => void;
  onChangeTabColor: (id: string, color: string) => void;
  onChangeZoom: (newZoom: number) => void;
}

export const SheetTabsBar: React.FC<SheetTabsBarProps> = ({
  sheets,
  activeSheetId,
  selection,
  activeCell,
  zoom,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDuplicateSheet,
  onDeleteSheet,
  onChangeTabColor,
  onChangeZoom,
}) => {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [tabContextMenu, setTabContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sheetId: string;
  } | null>(null);

  // Compute stats for current active sheet selection
  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const stats = React.useMemo(() => {
    if (!activeSheet) return { count: 0, numCount: 0, sum: 0, avg: 0 };

    const startRow = selection ? Math.min(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const endRow = selection ? Math.max(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const startCol = selection ? Math.min(selection.startCol, selection.endCol) : activeCell.colIdx;
    const endCol = selection ? Math.max(selection.startCol, selection.endCol) : activeCell.colIdx;

    let totalCount = 0;
    let numericCount = 0;
    let sum = 0;

    for (let r = startRow; r <= endRow; r++) {
      const row = activeSheet.rows[r];
      if (!row) continue;
      for (let c = startCol; c <= endCol; c++) {
        const colDef = activeSheet.columns[c];
        if (!colDef) continue;
        const val = row[colDef.id]?.value;
        if (val !== null && val !== undefined && val !== '') {
          totalCount++;
          const num = Number(val);
          if (!isNaN(num)) {
            numericCount++;
            sum += num;
          }
        }
      }
    }

    const avg = numericCount > 0 ? Math.round((sum / numericCount) * 100) / 100 : 0;
    return { count: totalCount, numCount: numericCount, sum, avg };
  }, [activeSheet, selection, activeCell]);

  const handleStartRename = (sheet: SheetData) => {
    setEditingSheetId(sheet.id);
    setEditingName(sheet.name);
    setTabContextMenu(null);
  };

  const handleFinishRename = (sheetId: string) => {
    if (editingName.trim()) {
      onRenameSheet(sheetId, editingName.trim());
    }
    setEditingSheetId(null);
  };

  return (
    <div className="flex items-center justify-between h-9 bg-neutral-900 border-t border-neutral-800 px-2 text-xs select-none">
      {/* Left side: Sheet tabs with scroll and add button */}
      <div className="flex items-center space-x-1 overflow-x-auto max-w-[65%] custom-scrollbar py-0.5">
        <button
          onClick={onAddSheet}
          title="Add New Sheet"
          className="p-1 hover:bg-neutral-800 text-cyan-400 hover:text-cyan-300 rounded transition flex items-center justify-center mr-1"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-1">
          {sheets.map((sheet) => {
            if (sheet.hidden) return null;
            const isActive = sheet.id === activeSheetId;

            return (
              <div
                key={sheet.id}
                onClick={() => onSelectSheet(sheet.id)}
                onDoubleClick={() => handleStartRename(sheet)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY - 120,
                    sheetId: sheet.id,
                  });
                }}
                className={`group flex items-center space-x-1.5 px-3 py-1 rounded-t text-xs font-medium cursor-pointer transition border-t-2 ${
                  isActive
                    ? 'bg-neutral-950 text-cyan-300 border-cyan-400 font-semibold shadow-sm'
                    : 'bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200 border-transparent'
                }`}
                style={{
                  borderTopColor: isActive ? (sheet.color || '#38bdf8') : undefined,
                }}
              >
                {/* Custom sheet color dot */}
                {sheet.color && (
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: sheet.color }}
                  />
                )}

                {editingSheetId === sheet.id ? (
                  <input
                    type="text"
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleFinishRename(sheet.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(sheet.id);
                      if (e.key === 'Escape') setEditingSheetId(null);
                    }}
                    className="bg-neutral-900 text-white px-1 py-0.5 text-xs rounded border border-cyan-500 outline-none w-24"
                  />
                ) : (
                  <span className="truncate max-w-[120px]">{sheet.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right side: Statistics and Zoom controls */}
      <div className="flex items-center space-x-4 text-[11px] font-mono text-neutral-400">
        {/* Selection Stats */}
        {stats.count > 1 && (
          <div className="hidden lg:flex items-center space-x-3 text-neutral-300 border-r border-neutral-800 pr-3">
            <span>
              Count: <strong className="text-cyan-400">{stats.count}</strong>
            </span>
            {stats.numCount > 0 && (
              <>
                <span>
                  Sum: <strong className="text-cyan-400">{stats.sum.toLocaleString()}</strong>
                </span>
                <span>
                  Avg: <strong className="text-cyan-400">{stats.avg.toLocaleString()}</strong>
                </span>
              </>
            )}
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onChangeZoom(Math.max(50, zoom - 10))}
            title="Zoom Out"
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-10 text-center text-neutral-300 font-sans font-semibold">{zoom}%</span>
          <button
            onClick={() => onChangeZoom(Math.min(150, zoom + 10))}
            title="Zoom In"
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && tabContextMenu.visible && (
        <div
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl py-1 text-xs text-neutral-200 w-48 backdrop-blur-md"
        >
          <button
            onClick={() => {
              const target = sheets.find((s) => s.id === tabContextMenu.sheetId);
              if (target) handleStartRename(target);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition"
          >
            Rename Sheet
          </button>
          <button
            onClick={() => {
              onDuplicateSheet(tabContextMenu.sheetId);
              setTabContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition"
          >
            Duplicate Sheet
          </button>
          <div className="h-[1px] bg-neutral-800 my-1" />
          <div className="px-3 py-1 text-[10px] text-neutral-500 font-semibold uppercase">Tab Color</div>
          <div className="px-3 py-1 flex items-center space-x-1.5">
            {['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  onChangeTabColor(tabContextMenu.sheetId, color);
                  setTabContextMenu(null);
                }}
                className="w-4 h-4 rounded-full border border-neutral-600 hover:scale-125 transition"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          {sheets.length > 1 && (
            <>
              <div className="h-[1px] bg-neutral-800 my-1" />
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this sheet?')) {
                    onDeleteSheet(tabContextMenu.sheetId);
                  }
                  setTabContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 transition"
              >
                Delete Sheet
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
