import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SheetData, SelectionRange, ConditionalFormatRule, PartyRule } from '../../types';
import { indexToColLetter, evaluateFormula } from '../../utils/formulaEngine';
import { lookupPartyInstruction } from '../../utils/ruleEngine';
import { Copy, Scissors, Clipboard, Plus, Trash2, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

interface SpreadsheetGridProps {
  sheet: SheetData;
  activeCell: { colIdx: number; rowIdx: number };
  selection: SelectionRange | null;
  zoom: number;
  conditionalFormats: ConditionalFormatRule[];
  partyRules: PartyRule[];
  onSelectCell: (colIdx: number, rowIdx: number, extend?: boolean) => void;
  onSetSelection: (selection: SelectionRange | null) => void;
  onUpdateCellValue: (rowIdx: number, colId: string, value: any, formula?: string) => void;
  onResizeColumn: (colId: string, width: number) => void;
  onResizeRow: (rowIdx: number, height: number) => void;
  onInsertRow: (position: 'above' | 'below', referenceRow?: number) => void;
  onDeleteRow: (rowIdx: number) => void;
  onInsertColumn: (colIdx: number, name: string) => void;
  onDeleteColumn: (colId: string) => void;
  onReorderColumns: (fromIdx: number, toIdx: number) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClearSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveManual: () => void;
  onOpenFormulaEdit: (initialChar?: string) => void;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  sheet,
  activeCell,
  selection,
  zoom,
  conditionalFormats,
  partyRules,
  onSelectCell,
  onSetSelection,
  onUpdateCellValue,
  onResizeColumn,
  onResizeRow,
  onInsertRow,
  onDeleteRow,
  onInsertColumn,
  onDeleteColumn,
  onReorderColumns,
  onCut,
  onCopy,
  onPaste,
  onClearSelection,
  onUndo,
  onRedo,
  onSaveManual,
}) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Inline editing state: activeCell is ALWAYS smoothly editable!
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Mouse dragging for selection
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const dragStartCell = useRef<{ colIdx: number; rowIdx: number } | null>(null);

  // Mouse dragging for fill handle
  const [isDraggingFillHandle, setIsDraggingFillHandle] = useState(false);

  // Column / Row resize state
  const [resizingCol, setResizingCol] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ rowIdx: number; startY: number; startHeight: number } | null>(null);

  // Column reordering drag state
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'cell' | 'row' | 'col';
    rowIdx?: number;
    colIdx?: number;
  }>({ visible: false, x: 0, y: 0, type: 'cell' });

  // Map duplicate invoice numbers for fast highlighting
  const duplicateInvNums = useMemo(() => {
    const invCol = sheet.columns.find((c) => c.name.toUpperCase() === 'INV NUM');
    if (!invCol) return new Set<string>();
    const counts = new Map<string, number>();
    sheet.rows.forEach((r) => {
      const val = String(r[invCol.id]?.value || '').trim();
      if (val) {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    });
    const dups = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) dups.add(key);
    });
    return dups;
  }, [sheet.rows, sheet.columns]);

  // Current normalized selection bounding box
  const normalizedSelection = useMemo(() => {
    if (!selection) {
      return {
        startCol: activeCell.colIdx,
        startRow: activeCell.rowIdx,
        endCol: activeCell.colIdx,
        endRow: activeCell.rowIdx,
      };
    }
    return {
      startCol: Math.min(selection.startCol, selection.endCol),
      startRow: Math.min(selection.startRow, selection.endRow),
      endCol: Math.max(selection.startCol, selection.endCol),
      endRow: Math.max(selection.startRow, selection.endRow),
    };
  }, [selection, activeCell]);

  const activeColDef = sheet.columns[activeCell.colIdx];
  const activeCellData = sheet.rows[activeCell.rowIdx]?.[activeColDef?.id];
  const currentCellVal = activeCellData?.value;
  const currentCellFormula = activeCellData?.formula;

  // Sync activeCell value to editValue and auto-focus with selected text (Excel / Google Sheets standard)
  useEffect(() => {
    const colDef = sheet.columns[activeCell.colIdx];
    const cell = sheet.rows[activeCell.rowIdx]?.[colDef?.id];
    const val = cell?.formula || (cell?.value !== null && cell?.value !== undefined ? String(cell?.value) : '');
    setEditValue(val);

    // Auto-focus and select text so typing immediately replaces, or arrow keys navigate smoothly
    const timer = setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [activeCell.colIdx, activeCell.rowIdx, sheet.id, currentCellVal, currentCellFormula]);

  // Candidates for AutoComplete in the active column
  const columnCandidates = useMemo(() => {
    const colDef = sheet.columns[activeCell.colIdx];
    if (!colDef) return [];

    const candidates = new Set<string>();

    // 1. All existing non-empty values in this column across the entire sheet
    sheet.rows.forEach((r, idx) => {
      if (idx !== activeCell.rowIdx) {
        const val = r[colDef.id]?.value;
        if (val !== null && val !== undefined && String(val).trim()) {
          candidates.add(String(val).trim());
        }
      }
    });

    // 2. Dropdown options if select column (e.g. REMARK: PENDING, PRINT, etc.)
    if (colDef.options) {
      colDef.options.forEach((opt) => candidates.add(opt));
    }

    // 3. Control Center Party Rules & Aliases if PARTY column
    if (colDef.name.toUpperCase() === 'PARTY') {
      partyRules.forEach((rule) => {
        if (rule.enabled) {
          candidates.add(rule.partyName);
          (rule.aliases || []).forEach((alias) => candidates.add(alias));
        }
      });
    }

    // 4. Sellers if SELLER column
    if (colDef.name.toUpperCase() === 'SELLER') {
      partyRules.forEach((rule) => {
        if (rule.sellerCondition) candidates.add(rule.sellerCondition);
      });
      candidates.add('AKSHAT');
      candidates.add('RUSHIKESH');
      candidates.add('NIKHIL');
      candidates.add('SURESH');
      candidates.add('VIPUL');
    }

    // 5. Remark options if REMARK column
    if (colDef.name.toUpperCase() === 'REMARK') {
      ['PENDING', 'PRINT', 'BACKDATED', 'UPLOADED', 'CANCELLATION'].forEach((opt) => candidates.add(opt));
    }

    // 6. Instructions if INSTRUCTIONS column
    if (colDef.name.toUpperCase() === 'INSTRUCTIONS') {
      partyRules.forEach((rule) => {
        if (rule.instruction) candidates.add(rule.instruction);
      });
    }

    return Array.from(candidates);
  }, [sheet.columns, sheet.rows, activeCell.colIdx, activeCell.rowIdx, partyRules]);

  // Compute active suggestion based on current editValue (Excel AutoComplete)
  const activeSuggestion = useMemo(() => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed.startsWith('=')) return null;

    const lower = trimmed.toLowerCase();

    // Check prefix match in candidates
    const match = columnCandidates.find(
      (c) => c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower
    );
    if (match) {
      return match;
    }

    // Also check previous row's value in this column
    if (activeCell.rowIdx > 0) {
      const colDef = sheet.columns[activeCell.colIdx];
      const aboveVal = colDef ? sheet.rows[activeCell.rowIdx - 1]?.[colDef.id]?.value : null;
      if (aboveVal && String(aboveVal).trim()) {
        const strAbove = String(aboveVal).trim();
        if (strAbove.toLowerCase().startsWith(lower) && strAbove.toLowerCase() !== lower) {
          return strAbove;
        }
      }
    }

    return null;
  }, [editValue, columnCandidates, activeCell, sheet]);

  const commitEditing = useCallback((newVal: string, moveDirection: 'down' | 'right' | 'left' | 'up' | 'none' = 'none') => {
    const colDef = sheet.columns[activeCell.colIdx];
    if (!colDef) return;

    let formula: string | undefined;
    let finalVal: any = newVal;

    if (newVal.startsWith('=')) {
      formula = newVal;
      const evalRes = evaluateFormula(newVal, sheet);
      finalVal = evalRes.value;
    }

    onUpdateCellValue(activeCell.rowIdx, colDef.id, finalVal, formula);

    if (moveDirection === 'right') {
      if (activeCell.colIdx < sheet.columns.length - 1) {
        onSelectCell(activeCell.colIdx + 1, activeCell.rowIdx, false);
      } else if (activeCell.rowIdx < sheet.rows.length - 1) {
        onSelectCell(0, activeCell.rowIdx + 1, false);
      }
    } else if (moveDirection === 'left') {
      if (activeCell.colIdx > 0) {
        onSelectCell(activeCell.colIdx - 1, activeCell.rowIdx, false);
      } else if (activeCell.rowIdx > 0) {
        onSelectCell(sheet.columns.length - 1, activeCell.rowIdx - 1, false);
      }
    } else if (moveDirection === 'down') {
      if (activeCell.rowIdx < sheet.rows.length - 1) {
        onSelectCell(activeCell.colIdx, activeCell.rowIdx + 1, false);
      }
    } else if (moveDirection === 'up') {
      if (activeCell.rowIdx > 0) {
        onSelectCell(activeCell.colIdx, activeCell.rowIdx - 1, false);
      }
    }
  }, [activeCell, sheet, onUpdateCellValue, onSelectCell]);

  // Keyboard navigation & Excel shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // If context menu is open, close it
    if (contextMenu.visible) {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const val = activeSuggestion || editValue;
      commitEditing(val, e.shiftKey ? 'left' : 'right');
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const val = activeSuggestion || editValue;
      commitEditing(val, 'down');
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      const colDef = sheet.columns[activeCell.colIdx];
      const orig = colDef ? (sheet.rows[activeCell.rowIdx]?.[colDef.id]?.formula || String(sheet.rows[activeCell.rowIdx]?.[colDef.id]?.value ?? '')) : '';
      setEditValue(orig);
      return;
    }

    if (e.key === 'ArrowRight' && activeSuggestion) {
      const inputEl = editInputRef.current;
      if (inputEl && inputEl.selectionStart === editValue.length) {
        e.preventDefault();
        setEditValue(activeSuggestion);
        return;
      }
    }

    // Ctrl + D or Ctrl + ': Fill down from cell directly above
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key === "'")) {
      e.preventDefault();
      if (activeCell.rowIdx > 0) {
        const colDef = sheet.columns[activeCell.colIdx];
        const valAbove = colDef ? sheet.rows[activeCell.rowIdx - 1]?.[colDef.id]?.value : '';
        if (valAbove !== null && valAbove !== undefined && valAbove !== '') {
          onUpdateCellValue(activeCell.rowIdx, colDef.id, valAbove);
          setEditValue(String(valAbove));
        }
      }
      return;
    }

    // Ctrl / Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          if (!window.getSelection()?.toString()) {
            e.preventDefault();
            onCopy();
          }
          return;
        case 'v':
          return;
        case 'x':
          e.preventDefault();
          onCut();
          return;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            onRedo();
          } else {
            onUndo();
          }
          return;
        case 'y':
          e.preventDefault();
          onRedo();
          return;
        case 'a':
          e.preventDefault();
          onSetSelection({
            startCol: 0,
            startRow: 0,
            endCol: sheet.columns.length - 1,
            endRow: sheet.rows.length - 1,
          });
          return;
        case 's':
          e.preventDefault();
          onSaveManual();
          return;
        case 'arrowup':
          e.preventDefault();
          commitEditing(activeSuggestion || editValue, 'none');
          onSelectCell(activeCell.colIdx, 0, e.shiftKey);
          return;
        case 'arrowdown':
          e.preventDefault();
          commitEditing(activeSuggestion || editValue, 'none');
          onSelectCell(activeCell.colIdx, sheet.rows.length - 1, e.shiftKey);
          return;
        case 'arrowleft':
          e.preventDefault();
          commitEditing(activeSuggestion || editValue, 'none');
          onSelectCell(0, activeCell.rowIdx, e.shiftKey);
          return;
        case 'arrowright':
          e.preventDefault();
          commitEditing(activeSuggestion || editValue, 'none');
          onSelectCell(sheet.columns.length - 1, activeCell.rowIdx, e.shiftKey);
          return;
        default:
          break;
      }
    }

    // Single key navigation
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        commitEditing(activeSuggestion || editValue, 'up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        commitEditing(activeSuggestion || editValue, 'down');
        break;
      case 'F2':
        e.preventDefault();
        if (editInputRef.current) {
          const len = editInputRef.current.value.length;
          editInputRef.current.setSelectionRange(len, len);
        }
        break;
      default:
        break;
    }
  }, [
    editValue,
    activeSuggestion,
    activeCell,
    sheet,
    contextMenu.visible,
    commitEditing,
    onCopy,
    onCut,
    onUndo,
    onRedo,
    onSetSelection,
    onSaveManual,
    onSelectCell,
    onUpdateCellValue,
  ]);

  // Global mouse handlers for resizing and dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol) {
        const delta = e.clientX - resizingCol.startX;
        const newWidth = Math.max(60, resizingCol.startWidth + delta);
        onResizeColumn(resizingCol.id, newWidth);
      } else if (resizingRow) {
        const delta = e.clientY - resizingRow.startY;
        const newHeight = Math.max(22, resizingRow.startHeight + delta);
        onResizeRow(resizingRow.rowIdx, newHeight);
      }
    };

    const handleMouseUp = () => {
      if (resizingCol) setResizingCol(null);
      if (resizingRow) setResizingRow(null);
      if (isDraggingSelection) setIsDraggingSelection(false);
      if (isDraggingFillHandle) {
        setIsDraggingFillHandle(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, resizingRow, isDraggingSelection, isDraggingFillHandle, onResizeColumn, onResizeRow]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  // Global window keydown listener: acts exactly like Excel / Google Sheets!
  // Single-clicking ANY cell or tabbing allows typing immediately without needing double-click!
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea outside grid (e.g. formula bar, search)
      const target = e.target as HTMLElement;
      if (
        target &&
        target !== editInputRef.current &&
        target !== gridContainerRef.current &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      handleKeyDown(e as any);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleKeyDown]);

  // Compute cell conditional style
  const getCellComputedStyle = (colDef: any, cellData: any, rowIdx: number) => {
    // 1. Identify row's REMARK status to color the WHOLE LINE identically
    const remarkCol = sheet.columns.find((c) => c.name.toUpperCase() === 'REMARK');
    let rowRemarkVal = remarkCol
      ? String(sheet.rows[rowIdx]?.[remarkCol.id]?.value || '').trim().toUpperCase()
      : '';

    // If this row is currently having its REMARK typed into, update the whole line live!
    if (activeCell.rowIdx === rowIdx && activeColDef?.name.toUpperCase() === 'REMARK') {
      const liveTyped = (activeSuggestion || editValue || '').trim().toUpperCase();
      if (liveTyped) {
        rowRemarkVal = liveTyped;
      }
    }

    let wholeLineBg: string | undefined;
    let wholeLineColor: string | undefined;

    if (rowRemarkVal.includes('PENDING') || rowRemarkVal.startsWith('PEND') || rowRemarkVal === 'PE') {
      wholeLineBg = '#FEF3C7';
      wholeLineColor = '#92400E';
    } else if (
      rowRemarkVal.includes('PRINT') ||
      rowRemarkVal.startsWith('PRIN') ||
      rowRemarkVal.startsWith('PRI') ||
      rowRemarkVal.startsWith('PR') ||
      rowRemarkVal === 'P'
    ) {
      wholeLineBg = '#DBEAFE';
      wholeLineColor = '#1E40AF';
    } else if (rowRemarkVal.includes('BACKDATED') || rowRemarkVal.startsWith('BACK')) {
      wholeLineBg = '#EDE9FE';
      wholeLineColor = '#5B21B6';
    } else if (rowRemarkVal.includes('UPLOADED') || rowRemarkVal.startsWith('UPLO')) {
      wholeLineBg = '#D1FAE5';
      wholeLineColor = '#065F46';
    } else if (rowRemarkVal.includes('CANCEL') || rowRemarkVal.startsWith('CANC')) {
      wholeLineBg = '#FEE2E2';
      wholeLineColor = '#991B1B';
    }

    // Baseline background and text color from whole line status, or cell custom styling
    let bg = cellData?.style?.bg || wholeLineBg;
    let color = cellData?.style?.color || wholeLineColor;
    let bold = cellData?.style?.bold || (wholeLineColor && (colDef.name.toUpperCase() === 'REMARK' || colDef.name.toUpperCase() === 'PARTY'));
    let italic = cellData?.style?.italic;
    let align = cellData?.style?.align || (colDef.type === 'number' ? 'right' : 'left');

    const colName = colDef.name.toUpperCase();
    const cellVal = cellData?.value !== null && cellData?.value !== undefined ? String(cellData.value).trim() : '';

    // Check duplicate invoice numbers (highlight duplicate with noticeable alert)
    if (colName === 'INV NUM' && cellVal && duplicateInvNums.has(cellVal)) {
      bg = '#FFE4E6';
      color = '#BE123C';
      bold = true;
    }

    // Missing / unconfigured instruction highlight for review
    if (colName.includes('INSTRUCTION') && (cellVal === 'Not Configured' || cellVal.includes('Not Configured'))) {
      bg = '#FFF7ED';
      color = '#C2410C';
      bold = true;
    }

    // Check custom conditional format rules
    for (const rule of conditionalFormats.filter((r) => r.enabled)) {
      if (rule.columnId === colDef.id || rule.columnId === colDef.name) {
        let match = false;
        switch (rule.operator) {
          case 'equals':
            match = cellVal.toUpperCase() === rule.value.toUpperCase();
            break;
          case 'contains':
            match = cellVal.toUpperCase().includes(rule.value.toUpperCase());
            break;
          case 'is_empty':
            match = cellVal === '';
            break;
          case 'is_duplicate':
            match = colName === 'INV NUM' && duplicateInvNums.has(cellVal);
            break;
          default:
            break;
        }
        if (match) {
          bg = rule.bg;
          color = rule.color;
          break;
        }
      }
    }

    return { bg, color, bold, italic, align, wholeLineBg, wholeLineColor };
  };

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-auto outline-none relative bg-neutral-950 select-none custom-scrollbar"
      style={{
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top left',
        width: `${100 * (100 / zoom)}%`,
        height: `${100 * (100 / zoom)}%`,
      }}
    >
      <table className="border-collapse table-fixed w-max text-xs font-sans">
        {/* FROZEN HEADER ROW: Column Letters & Headers */}
        <thead className="sticky top-0 z-20 bg-neutral-900 shadow-md">
          {/* Row 1: Column Letters (A, B, C...) with resize handle */}
          <tr className="h-7 border-b border-neutral-700 bg-neutral-900 text-neutral-400 font-mono text-[11px]">
            {/* Top-Left Select All Corner Cell */}
            <th
              onClick={() =>
                onSetSelection({
                  startCol: 0,
                  startRow: 0,
                  endCol: sheet.columns.length - 1,
                  endRow: sheet.rows.length - 1,
                })
              }
              title="Select all (Ctrl+A)"
              className="sticky left-0 z-30 w-12 min-w-[48px] bg-neutral-900 border-r border-b border-neutral-700 hover:bg-neutral-800 cursor-pointer text-center"
            >
              <div className="w-2.5 h-2.5 mx-auto border-r-2 border-b-2 border-neutral-500" />
            </th>

            {sheet.columns.map((col, colIdx) => {
              if (col.hidden) return null;
              const isColSelected =
                normalizedSelection.startCol <= colIdx && normalizedSelection.endCol >= colIdx;

              return (
                <th
                  key={col.id}
                  style={{ width: col.width, minWidth: col.width }}
                  draggable
                  onDragStart={() => setDraggedColIdx(colIdx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverColIdx(colIdx);
                  }}
                  onDrop={() => {
                    if (draggedColIdx !== null && dragOverColIdx !== null && draggedColIdx !== dragOverColIdx) {
                      onReorderColumns(draggedColIdx, dragOverColIdx);
                    }
                    setDraggedColIdx(null);
                    setDragOverColIdx(null);
                  }}
                  onClick={(e) => {
                    onSetSelection({
                      startCol: colIdx,
                      startRow: 0,
                      endCol: colIdx,
                      endRow: sheet.rows.length - 1,
                    });
                    onSelectCell(colIdx, 0, e.shiftKey);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      type: 'col',
                      colIdx,
                    });
                  }}
                  className={`relative px-2 py-1 border-r border-neutral-800 text-center font-semibold cursor-pointer transition ${
                    isColSelected ? 'bg-cyan-950/60 text-cyan-300' : 'hover:bg-neutral-800 text-neutral-400'
                  } ${dragOverColIdx === colIdx ? 'border-l-2 border-l-cyan-400' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-full text-center">{indexToColLetter(colIdx)}</span>
                  </div>

                  {/* Column resize divider handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizingCol({ id: col.id, startX: e.clientX, startWidth: col.width });
                    }}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500 z-10"
                  />
                </th>
              );
            })}
          </tr>

          {/* Row 2: Actual Column Title (SR NUM, TRN NUM, INV NUM, PARTY, SELLER, REMARK, INSTRUCTIONS) */}
          <tr className="h-8 border-b-2 border-neutral-700 bg-neutral-900/95 backdrop-blur-sm text-neutral-200 text-xs font-semibold">
            <th className="sticky left-0 z-30 w-12 min-w-[48px] bg-neutral-900 border-r border-neutral-700 text-neutral-500 text-[10px] text-center">
              TITLE
            </th>
            {sheet.columns.map((col, colIdx) => {
              if (col.hidden) return null;
              const isColSelected =
                normalizedSelection.startCol <= colIdx && normalizedSelection.endCol >= colIdx;

              return (
                <th
                  key={`title_${col.id}`}
                  style={{ width: col.width, minWidth: col.width }}
                  onClick={(e) => {
                    onSetSelection({
                      startCol: colIdx,
                      startRow: 0,
                      endCol: colIdx,
                      endRow: sheet.rows.length - 1,
                    });
                    onSelectCell(colIdx, 0, e.shiftKey);
                  }}
                  className={`px-3 py-1.5 border-r border-neutral-800 text-left truncate cursor-pointer transition ${
                    isColSelected ? 'bg-cyan-950/40 text-cyan-300' : 'text-neutral-300'
                  }`}
                  title={`${col.name} (${indexToColLetter(colIdx)})`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{col.name}</span>
                    {col.type === 'select' && (
                      <span className="text-[9px] px-1 py-0.2 bg-neutral-800 text-neutral-400 rounded">Dropdown</span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* SPREADSHEET BODY ROWS */}
        <tbody>
          {sheet.rows.map((row, rowIdx) => {
            const isRowSelected =
              normalizedSelection.startRow <= rowIdx && normalizedSelection.endRow >= rowIdx;
            const customHeight = sheet.rowHeights?.[rowIdx] || 26;

            // Determine row status for row header accent
            const remarkCol = sheet.columns.find((c) => c.name.toUpperCase() === 'REMARK');
            const rowRemarkVal = remarkCol
              ? String(row[remarkCol.id]?.value || '').trim().toUpperCase()
              : '';

            let rowIndicatorColor: string | undefined;
            if (rowRemarkVal === 'PENDING') rowIndicatorColor = '#D97706';
            else if (rowRemarkVal === 'PRINT') rowIndicatorColor = '#2563EB';
            else if (rowRemarkVal === 'BACKDATED') rowIndicatorColor = '#7C3AED';
            else if (rowRemarkVal === 'UPLOADED') rowIndicatorColor = '#059669';
            else if (rowRemarkVal === 'CANCELLATION') rowIndicatorColor = '#DC2626';

            return (
              <tr
                key={`row_${rowIdx}`}
                style={{ height: customHeight }}
                className={`border-b border-neutral-800/80 transition-colors ${
                  isRowSelected ? 'bg-cyan-950/20' : 'hover:bg-neutral-900/40'
                }`}
              >
                {/* Sticky Row Number Column (1, 2, 3...) with row resize handle and status accent */}
                <td
                  onClick={(e) => {
                    onSetSelection({
                      startCol: 0,
                      startRow: rowIdx,
                      endCol: sheet.columns.length - 1,
                      endRow: rowIdx,
                    });
                    onSelectCell(0, rowIdx, e.shiftKey);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      type: 'row',
                      rowIdx,
                    });
                  }}
                  style={{
                    borderLeft: rowIndicatorColor ? `4px solid ${rowIndicatorColor}` : undefined,
                  }}
                  className={`sticky left-0 z-10 w-12 min-w-[48px] bg-neutral-900 border-r border-neutral-800 text-center font-mono text-[11px] cursor-pointer select-none relative ${
                    isRowSelected ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-neutral-500 hover:bg-neutral-800'
                  }`}
                >
                  <span>{rowIdx + 1}</span>

                  {/* Row resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setResizingRow({ rowIdx, startY: e.clientY, startHeight: customHeight });
                    }}
                    className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-cyan-500 z-10"
                  />
                </td>

                {/* Data Cells (Entire Line Colored Based on REMARK Status) */}
                {sheet.columns.map((col, colIdx) => {
                  if (col.hidden) return null;
                  const cell = row[col.id];
                  const isActive = activeCell.colIdx === colIdx && activeCell.rowIdx === rowIdx;
                  const isInSelection =
                    colIdx >= normalizedSelection.startCol &&
                    colIdx <= normalizedSelection.endCol &&
                    rowIdx >= normalizedSelection.startRow &&
                    rowIdx <= normalizedSelection.endRow;

                  const isFillHandleCorner =
                    colIdx === normalizedSelection.endCol && rowIdx === normalizedSelection.endRow;

                  const styleProps = getCellComputedStyle(col, cell, rowIdx);
                  const isWholeLineColored = Boolean(styleProps.wholeLineBg);

                  // Evaluate formula if value is dynamic formula
                  let displayValue: any = cell?.value ?? '';
                  if (cell?.formula) {
                    const evalRes = evaluateFormula(cell.formula, sheet);
                    displayValue = evalRes.value;
                  }

                  // LIVE instruction preview for the row currently being edited
                  const isInstCol = col.name.trim().toUpperCase().includes('INSTRUCTION');
                  if (isInstCol && rowIdx === activeCell.rowIdx) {
                    const partyColDef = sheet.columns.find((c) => c.name.trim().toUpperCase().includes('PARTY'));
                    const sellerColDef = sheet.columns.find((c) => c.name.trim().toUpperCase().includes('SELLER'));

                    const liveParty = activeColDef?.name.trim().toUpperCase().includes('PARTY')
                      ? (activeSuggestion || editValue || '').trim()
                      : partyColDef ? String(row[partyColDef.id]?.value || '').trim() : '';

                    const liveSeller = activeColDef?.name.trim().toUpperCase().includes('SELLER')
                      ? (activeSuggestion || editValue || '').trim()
                      : sellerColDef ? String(row[sellerColDef.id]?.value || '').trim() : '';

                    if (liveParty) {
                      const lookup = lookupPartyInstruction(liveParty, liveSeller, partyRules);
                      if (lookup.found) {
                        displayValue = lookup.instruction;
                      } else {
                        displayValue = 'Not Configured';
                      }
                    }
                  }

                  return (
                    <td
                      key={`cell_${rowIdx}_${col.id}`}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        backgroundColor: styleProps.bg,
                        color: styleProps.color || '#e5e5e5',
                        fontWeight: styleProps.bold ? 'bold' : 'normal',
                        fontStyle: styleProps.italic ? 'italic' : 'normal',
                        textAlign: styleProps.align as any,
                        borderColor: isWholeLineColored ? 'rgba(0, 0, 0, 0.15)' : undefined,
                      }}
                      onMouseDown={(e) => {
                        if (e.button === 0) {
                          dragStartCell.current = { colIdx, rowIdx };
                          setIsDraggingSelection(true);
                          if (activeCell.colIdx !== colIdx || activeCell.rowIdx !== rowIdx) {
                            // Commit pending changes of previous cell before switching
                            const prevColDef = sheet.columns[activeCell.colIdx];
                            if (prevColDef) {
                              const val = activeSuggestion || editValue;
                              let formula: string | undefined;
                              let finalVal: any = val;
                              if (val.startsWith('=')) {
                                formula = val;
                                finalVal = evaluateFormula(val, sheet).value;
                              }
                              const oldCell = sheet.rows[activeCell.rowIdx]?.[prevColDef.id];
                              const oldVal = oldCell?.formula || oldCell?.value;
                              if (finalVal !== oldVal) {
                                onUpdateCellValue(activeCell.rowIdx, prevColDef.id, finalVal, formula);
                              }
                            }
                            onSelectCell(colIdx, rowIdx, e.shiftKey);
                          }
                        }
                      }}
                      onMouseEnter={() => {
                        if (isDraggingSelection && dragStartCell.current) {
                          onSetSelection({
                            startCol: dragStartCell.current.colIdx,
                            startRow: dragStartCell.current.rowIdx,
                            endCol: colIdx,
                            endRow: rowIdx,
                          });
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onSelectCell(colIdx, rowIdx, false);
                        setContextMenu({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          type: 'cell',
                          rowIdx,
                          colIdx,
                        });
                      }}
                      className={`relative px-2.5 py-1 text-xs border-r border-b border-neutral-800 truncate transition-colors ${
                        isActive
                          ? 'ring-2 ring-cyan-400 z-10'
                          : isInSelection
                          ? 'bg-cyan-500/10'
                          : ''
                      }`}
                    >
                      {/* Active Cell is ALWAYS in smooth, single-click editable mode! Zero double-click needed! */}
                      {isActive ? (
                        <div className="absolute inset-0 z-30 flex items-center bg-neutral-900 border-2 border-cyan-400 shadow-2xl rounded-[1px] overflow-visible">
                          <div className="relative flex-1 h-full flex items-center min-w-0">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const val = activeSuggestion || editValue;
                                  commitEditing(val, e.shiftKey ? 'left' : 'right');
                                  return;
                                }
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const val = activeSuggestion || editValue;
                                  commitEditing(val, 'down');
                                  return;
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const colDef = sheet.columns[activeCell.colIdx];
                                  const orig = colDef ? (sheet.rows[activeCell.rowIdx]?.[colDef.id]?.formula || String(sheet.rows[activeCell.rowIdx]?.[colDef.id]?.value ?? '')) : '';
                                  setEditValue(orig);
                                  return;
                                }
                                if (e.key === 'ArrowRight' && activeSuggestion) {
                                  const inputEl = editInputRef.current;
                                  if (inputEl && inputEl.selectionStart === editValue.length) {
                                    e.preventDefault();
                                    setEditValue(activeSuggestion);
                                    return;
                                  }
                                }
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitEditing(activeSuggestion || editValue, 'up');
                                  return;
                                }
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitEditing(activeSuggestion || editValue, 'down');
                                  return;
                                }
                                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                                  e.preventDefault();
                                  onSaveManual();
                                  return;
                                }
                                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                                  e.preventDefault();
                                  if (e.shiftKey) onRedo();
                                  else onUndo();
                                  return;
                                }
                                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                                  e.preventDefault();
                                  onRedo();
                                  return;
                                }
                              }}
                              onBlur={() => {
                                const val = activeSuggestion || editValue;
                                const colDef = sheet.columns[activeCell.colIdx];
                                if (colDef) {
                                  let formula: string | undefined;
                                  let finalVal: any = val;
                                  if (val.startsWith('=')) {
                                    formula = val;
                                    finalVal = evaluateFormula(val, sheet).value;
                                  }
                                  const currentVal = sheet.rows[activeCell.rowIdx]?.[colDef.id]?.value;
                                  if (finalVal !== currentVal) {
                                    onUpdateCellValue(activeCell.rowIdx, colDef.id, finalVal, formula);
                                  }
                                }
                              }}
                              className="w-full h-full bg-neutral-900 text-white px-2 text-xs outline-none font-sans z-10 font-semibold"
                            />

                            {/* Ghost AutoComplete Text overlay behind/alongside the input */}
                            {activeSuggestion && (
                              <div className="absolute inset-0 px-2 flex items-center pointer-events-none text-xs font-sans whitespace-pre overflow-hidden z-20">
                                <span className="opacity-0">{editValue}</span>
                                <span className="text-cyan-400 font-bold bg-cyan-950/90 px-0.5 rounded shadow">
                                  {activeSuggestion.slice(editValue.length)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Floating AutoComplete Pill / Tooltip */}
                          {activeSuggestion && (
                            <div className="absolute left-0 -bottom-7 z-50 bg-neutral-900 border border-cyan-500 shadow-2xl px-2.5 py-0.5 rounded flex items-center space-x-1.5 text-[11px] text-cyan-300 font-sans pointer-events-none whitespace-nowrap animate-in fade-in duration-100">
                              <span className="bg-neutral-800 px-1.5 py-0.2 rounded font-mono font-bold text-white border border-neutral-700 shadow-sm">Tab ⇥</span>
                              <span>Accept: <strong className="text-white font-bold">{activeSuggestion}</strong></span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="truncate w-full h-full flex items-center">
                          {displayValue !== null && displayValue !== undefined && displayValue !== '' ? (
                            <span>{String(displayValue)}</span>
                          ) : (
                            <span className={isWholeLineColored ? "opacity-30 select-none" : "text-neutral-700 select-none"}>&nbsp;</span>
                          )}
                        </div>
                      )}

                      {/* Excel Selection Fill Handle Corner Dot */}
                      {isFillHandleCorner && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsDraggingFillHandle(true);
                          }}
                          title="Drag to autofill / series"
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-white cursor-crosshair z-20 rounded-[1px] shadow-sm"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* RIGHT-CLICK CONTEXT MENU */}
      {contextMenu.visible && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl py-1 text-xs text-neutral-200 w-52 backdrop-blur-md"
        >
          {contextMenu.type === 'cell' && (
            <>
              <button
                onClick={() => {
                  onCut();
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Scissors className="w-3.5 h-3.5 text-neutral-400" />
                <span>Cut (Ctrl+X)</span>
              </button>
              <button
                onClick={() => {
                  onCopy();
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy (Ctrl+C)</span>
              </button>
              <button
                onClick={() => {
                  onPaste();
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Clipboard className="w-3.5 h-3.5 text-neutral-400" />
                <span>Paste (Ctrl+V)</span>
              </button>
              <div className="h-[1px] bg-neutral-800 my-1" />
              <button
                onClick={() => {
                  onClearSelection();
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 text-rose-300 transition"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Contents (Del)</span>
              </button>
              <div className="h-[1px] bg-neutral-800 my-1" />
              <button
                onClick={() => {
                  onInsertRow('above', contextMenu.rowIdx);
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Insert Row Above</span>
              </button>
              <button
                onClick={() => {
                  onInsertRow('below', contextMenu.rowIdx);
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Insert Row Below</span>
              </button>
              {contextMenu.rowIdx !== undefined && (
                <button
                  onClick={() => {
                    onDeleteRow(contextMenu.rowIdx!);
                    setContextMenu((p) => ({ ...p, visible: false }));
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Row {contextMenu.rowIdx + 1}</span>
                </button>
              )}
            </>
          )}

          {contextMenu.type === 'row' && (
            <>
              <button
                onClick={() => {
                  onInsertRow('above', contextMenu.rowIdx);
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Insert Row Above</span>
              </button>
              <button
                onClick={() => {
                  onInsertRow('below', contextMenu.rowIdx);
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Insert Row Below</span>
              </button>
              {contextMenu.rowIdx !== undefined && (
                <button
                  onClick={() => {
                    onDeleteRow(contextMenu.rowIdx!);
                    setContextMenu((p) => ({ ...p, visible: false }));
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Row</span>
                </button>
              )}
            </>
          )}

          {contextMenu.type === 'col' && contextMenu.colIdx !== undefined && (
            <>
              <button
                onClick={() => {
                  const colName = prompt('Enter new column name:');
                  if (colName) {
                    onInsertColumn(contextMenu.colIdx!, colName);
                  }
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-neutral-800 transition"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Insert Column Left</span>
              </button>
              <button
                onClick={() => {
                  const colId = sheet.columns[contextMenu.colIdx!]?.id;
                  if (colId) {
                    onDeleteColumn(colId);
                  }
                  setContextMenu((p) => ({ ...p, visible: false }));
                }}
                className="w-full flex items-center space-x-2 px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Column</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
