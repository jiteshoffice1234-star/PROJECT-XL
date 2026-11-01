import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SheetData,
  WorkbookState,
  SelectionRange,
  PartyRule,
  AutomationRule,
  AppSettings,
  AuditLogEntry,
  ColumnDef,
} from './types';
import { getInitialWorkbook } from './data/initialData';
import {
  loadSavedWorkbook,
  saveWorkbookToLocal,
  backupWorkbookToServer,
  exportToExcel,
} from './utils/storage';
import { processAutomations, lookupPartyInstruction, normalizePartyName } from './utils/ruleEngine';
import { indexToColLetter, evaluateFormula } from './utils/formulaEngine';

export function getEffectivePartyRules(wb: WorkbookState): PartyRule[] {
  const rules = [...wb.controlCenterRules];
  const controlSheet = wb.sheets.find((s) => s.name.toUpperCase().includes('CONTROL'));
  if (controlSheet) {
    const nameCol = controlSheet.columns.find((c) => c.name.toUpperCase().includes('PARTY'));
    const instCol = controlSheet.columns.find((c) => c.name.toUpperCase().includes('INSTRUCTION'));
    const sellerCol = controlSheet.columns.find((c) => c.name.toUpperCase().includes('SELLER'));
    const priorityCol = controlSheet.columns.find((c) => c.name.toUpperCase().includes('PRIORITY'));

    if (nameCol && instCol) {
      controlSheet.rows.forEach((r, idx) => {
        const partyName = String(r[nameCol.id]?.value || '').trim();
        const instruction = String(r[instCol.id]?.value || '').trim();
        const sellerCondition = sellerCol ? String(r[sellerCol.id]?.value || '').trim().replace(/^\(Any Seller\)$/i, '') : '';
        const priority = priorityCol ? Number(r[priorityCol.id]?.value) || 5 : 5;

        if (partyName && instruction) {
          const existing = rules.find(
            (rule) =>
              normalizePartyName(rule.partyName) === normalizePartyName(partyName) &&
              normalizePartyName(rule.sellerCondition || '') === normalizePartyName(sellerCondition)
          );
          if (!existing) {
            rules.push({
              id: `sheet_rule_${idx}`,
              partyName,
              sellerCondition,
              instruction,
              priority,
              enabled: true,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });
    }
  }
  return rules;
}

// Components
import { SpreadsheetGrid } from './components/spreadsheet/SpreadsheetGrid';
import { SpreadsheetToolbar } from './components/spreadsheet/SpreadsheetToolbar';
import { FormulaBar } from './components/spreadsheet/FormulaBar';
import { SheetTabsBar } from './components/spreadsheet/SheetTabsBar';
import { ColumnManagerModal } from './components/spreadsheet/ColumnManagerModal';
import { ControlCenterView } from './components/control-center/ControlCenterView';
import { AutomationStudioView } from './components/automation/AutomationStudioView';
import { DataManagerView } from './components/data-manager/DataManagerView';
import { SettingsView } from './components/settings/SettingsView';
import { GeminiAIAssistantModal } from './components/ai/GeminiAIAssistantModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';

// Icons
import {
  Table2,
  Cpu,
  Zap,
  Database,
  Settings as SettingsIcon,
  Sparkles,
  Search,
  FileSpreadsheet,
  Download,
  Volume2,
} from 'lucide-react';

export default function App() {
  // Main workbook state loaded from local-first storage or initial dataset
  const [workbook, setWorkbook] = useState<WorkbookState>(() => loadSavedWorkbook());
  const [activeSection, setActiveSection] = useState<'workspace' | 'control_center' | 'automation' | 'data_manager' | 'settings'>('workspace');

  // Spreadsheet Selection & Grid State
  const [activeCell, setActiveCell] = useState<{ colIdx: number; rowIdx: number }>({ colIdx: 3, rowIdx: 0 }); // Start on PARTY col
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [zoom, setZoom] = useState(100);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<WorkbookState[]>([]);
  const [redoStack, setRedoStack] = useState<WorkbookState[]>([]);

  // Internal clipboard for multi-cell copy/paste
  const clipboardDataRef = useRef<{ rows: any[][] } | null>(null);

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Modals state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalDefaultTab, setAiModalDefaultTab] = useState<'chat' | 'tts' | 'image'>('chat');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);

  // Active sheet
  const activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];

  // Auto-save debounced effect
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      const savedLocal = saveWorkbookToLocal(workbook);
      if (savedLocal) {
        setSaveStatus('saved');
        // Silent background server snapshot
        backupWorkbookToServer(workbook).catch(() => {});
      } else {
        setSaveStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [workbook]);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Push state snapshot to undo stack
  const pushUndoSnapshot = useCallback((stateBeforeChange: WorkbookState) => {
    setUndoStack((prev) => [...prev.slice(-30), stateBeforeChange]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, workbook]);
    setWorkbook(previous);
  }, [undoStack, workbook]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, workbook]);
    setWorkbook(next);
  }, [redoStack, workbook]);

  // Update single cell value with automatic instruction lookup and automation triggers
  const handleUpdateCellValue = useCallback(
    (rowIdx: number, colId: string, value: any, formula?: string) => {
      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;

        const currentSheet = prev.sheets[currentSheetIndex];
        const newRows = [...currentSheet.rows];
        const oldRow = { ...(newRows[rowIdx] || {}) };
        const oldVal = oldRow[colId]?.value ?? '';

        // Update target cell
        let updatedRow = {
          ...oldRow,
          [colId]: {
            ...oldRow[colId],
            value,
            formula,
          },
        };

        const targetColDef = currentSheet.columns.find((c) => c.id === colId);
        const colName = targetColDef?.name.toUpperCase();

        newRows[rowIdx] = updatedRow;

        const effectiveRules = getEffectivePartyRules(prev);

        // Automatic Instruction Lookup trigger when PARTY or SELLER changes
        const { updatedRow: automatedRow, actionsTaken } = processAutomations(
          'on_cell_edit',
          { ...currentSheet, rows: newRows },
          rowIdx,
          colId,
          prev.automations,
          effectiveRules
        );
        updatedRow = automatedRow;
        newRows[rowIdx] = updatedRow;

        // Log audit trail
        const newLogs: AuditLogEntry[] = [...prev.auditLogs];
        if (actionsTaken.length > 0) {
          actionsTaken.forEach((actionText) => {
            newLogs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toISOString(),
              sheetName: currentSheet.name,
              cellCoord: `${indexToColLetter(activeCell.colIdx)}${rowIdx + 1}`,
              oldValue: String(oldVal),
              newValue: String(value),
              source: 'lookup',
              description: actionText,
            });
          });
        }

        const updatedSheet: SheetData = {
          ...currentSheet,
          rows: newRows,
        };

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = updatedSheet;

        return {
          ...prev,
          sheets: updatedSheets,
          auditLogs: newLogs.slice(0, 100),
        };
      });
    },
    [workbook, pushUndoSnapshot, activeCell.colIdx]
  );

  // Cell Selection Handlers
  const handleSelectCell = useCallback((colIdx: number, rowIdx: number, extend = false) => {
    setActiveCell({ colIdx, rowIdx });
    if (!extend) {
      setSelection(null);
    } else {
      setSelection((prev) => {
        if (!prev) {
          return {
            startCol: activeCell.colIdx,
            startRow: activeCell.rowIdx,
            endCol: colIdx,
            endRow: rowIdx,
          };
        }
        return {
          ...prev,
          endCol: colIdx,
          endRow: rowIdx,
        };
      });
    }
  }, [activeCell]);

  // Copy selected cells to internal clipboard & navigator.clipboard as TSV (Excel compatible)
  const handleCopy = useCallback(() => {
    const startRow = selection ? Math.min(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const endRow = selection ? Math.max(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const startCol = selection ? Math.min(selection.startCol, selection.endCol) : activeCell.colIdx;
    const endCol = selection ? Math.max(selection.startCol, selection.endCol) : activeCell.colIdx;

    const copiedMatrix: any[][] = [];
    const tsvLines: string[] = [];

    for (let r = startRow; r <= endRow; r++) {
      const rowItem = activeSheet.rows[r];
      const rowVals: any[] = [];
      const lineItems: string[] = [];

      for (let c = startCol; c <= endCol; c++) {
        const colDef = activeSheet.columns[c];
        const cell = rowItem?.[colDef?.id];
        const val = (cell?.formula || cell?.value) ?? '';
        rowVals.push(val);
        lineItems.push(String(val));
      }
      copiedMatrix.push(rowVals);
      tsvLines.push(lineItems.join('\t'));
    }

    clipboardDataRef.current = { rows: copiedMatrix };
    const tsvString = tsvLines.join('\n');
    navigator.clipboard?.writeText(tsvString).catch(() => {});
  }, [activeSheet, selection, activeCell]);

  // Paste cells (supports multi-cell and external Excel TSV data)
  const handlePaste = useCallback(async () => {
    let matrixToPaste: any[][] = [];

    // Try reading real clipboard text from external spreadsheet (Excel)
    try {
      const clipText = await navigator.clipboard?.readText();
      if (clipText && clipText.trim()) {
        const lines = clipText.split(/\r?\n/).filter((l) => l.length > 0);
        matrixToPaste = lines.map((l) => l.split('\t'));
      }
    } catch {
      // fallback to internal clipboard
    }

    if (matrixToPaste.length === 0 && clipboardDataRef.current) {
      matrixToPaste = clipboardDataRef.current.rows;
    }

    if (matrixToPaste.length === 0) return;

    pushUndoSnapshot(workbook);

    setWorkbook((prev) => {
      const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
      if (currentSheetIndex === -1) return prev;

      const currentSheet = prev.sheets[currentSheetIndex];
      const newRows = [...currentSheet.rows];

      const startR = activeCell.rowIdx;
      const startC = activeCell.colIdx;

      // Expand rows if needed
      while (newRows.length < startR + matrixToPaste.length) {
        const emptyRow: any = {};
        currentSheet.columns.forEach((c) => {
          emptyRow[c.id] = { value: '' };
        });
        newRows.push(emptyRow);
      }

      matrixToPaste.forEach((rowVals, rOffset) => {
        const targetR = startR + rOffset;
        if (targetR >= newRows.length) return;

        let rowObj = { ...newRows[targetR] };
        rowVals.forEach((val, cOffset) => {
          const targetC = startC + cOffset;
          if (targetC >= currentSheet.columns.length) return;

          const colDef = currentSheet.columns[targetC];
          let formula: string | undefined;
          let cellVal = val;
          if (String(val).startsWith('=')) {
            formula = String(val);
            cellVal = evaluateFormula(formula, currentSheet).value;
          }

          rowObj[colDef.id] = {
            ...rowObj[colDef.id],
            value: cellVal,
            formula,
          };
        });

        // Trigger automatic lookup if party was pasted
        const partyCol = currentSheet.columns.find((c) => c.name.toUpperCase() === 'PARTY');
        const sellerCol = currentSheet.columns.find((c) => c.name.toUpperCase() === 'SELLER');
        const instCol = currentSheet.columns.find((c) => c.name.toUpperCase() === 'INSTRUCTIONS');
        if (partyCol && instCol) {
          const pVal = rowObj[partyCol.id]?.value;
          const sVal = sellerCol ? rowObj[sellerCol.id]?.value : '';
          if (pVal) {
            const lookup = lookupPartyInstruction(String(pVal), String(sVal || ''), prev.controlCenterRules);
            if (lookup.found) {
              rowObj[instCol.id] = {
                ...rowObj[instCol.id],
                value: lookup.instruction,
              };
            }
          }
        }

        newRows[targetR] = rowObj;
      });

      const updatedSheet: SheetData = {
        ...currentSheet,
        rows: newRows,
      };

      const updatedSheets = [...prev.sheets];
      updatedSheets[currentSheetIndex] = updatedSheet;

      return {
        ...prev,
        sheets: updatedSheets,
      };
    });
  }, [activeCell, workbook, pushUndoSnapshot]);

  // Cut selected cells
  const handleCut = useCallback(() => {
    handleCopy();
    // Clear selection
    const startRow = selection ? Math.min(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const endRow = selection ? Math.max(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const startCol = selection ? Math.min(selection.startCol, selection.endCol) : activeCell.colIdx;
    const endCol = selection ? Math.max(selection.startCol, selection.endCol) : activeCell.colIdx;

    pushUndoSnapshot(workbook);

    setWorkbook((prev) => {
      const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
      if (currentSheetIndex === -1) return prev;
      const currentSheet = prev.sheets[currentSheetIndex];
      const newRows = [...currentSheet.rows];

      for (let r = startRow; r <= endRow; r++) {
        if (!newRows[r]) continue;
        const rowObj = { ...newRows[r] };
        for (let c = startCol; c <= endCol; c++) {
          const colDef = currentSheet.columns[c];
          if (colDef) {
            rowObj[colDef.id] = { ...rowObj[colDef.id], value: '', formula: undefined };
          }
        }
        newRows[r] = rowObj;
      }

      const updatedSheets = [...prev.sheets];
      updatedSheets[currentSheetIndex] = { ...currentSheet, rows: newRows };
      return { ...prev, sheets: updatedSheets };
    });
  }, [handleCopy, selection, activeCell, workbook, pushUndoSnapshot]);

  // Clear selection contents
  const handleClearSelection = useCallback(() => {
    const startRow = selection ? Math.min(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const endRow = selection ? Math.max(selection.startRow, selection.endRow) : activeCell.rowIdx;
    const startCol = selection ? Math.min(selection.startCol, selection.endCol) : activeCell.colIdx;
    const endCol = selection ? Math.max(selection.startCol, selection.endCol) : activeCell.colIdx;

    pushUndoSnapshot(workbook);

    setWorkbook((prev) => {
      const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
      if (currentSheetIndex === -1) return prev;
      const currentSheet = prev.sheets[currentSheetIndex];
      const newRows = [...currentSheet.rows];

      for (let r = startRow; r <= endRow; r++) {
        if (!newRows[r]) continue;
        const rowObj = { ...newRows[r] };
        for (let c = startCol; c <= endCol; c++) {
          const colDef = currentSheet.columns[c];
          if (colDef) {
            rowObj[colDef.id] = { ...rowObj[colDef.id], value: '', formula: undefined };
          }
        }
        newRows[r] = rowObj;
      }

      const updatedSheets = [...prev.sheets];
      updatedSheets[currentSheetIndex] = { ...currentSheet, rows: newRows };
      return { ...prev, sheets: updatedSheets };
    });
  }, [selection, activeCell, workbook, pushUndoSnapshot]);

  // Format styles (Bold, Italic, Align, Bg, Color)
  const handleFormatStyle = useCallback(
    (style: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right'; bg?: string; color?: string }) => {
      const startRow = selection ? Math.min(selection.startRow, selection.endRow) : activeCell.rowIdx;
      const endRow = selection ? Math.max(selection.startRow, selection.endRow) : activeCell.rowIdx;
      const startCol = selection ? Math.min(selection.startCol, selection.endCol) : activeCell.colIdx;
      const endCol = selection ? Math.max(selection.startCol, selection.endCol) : activeCell.colIdx;

      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newRows = [...currentSheet.rows];

        for (let r = startRow; r <= endRow; r++) {
          if (!newRows[r]) continue;
          const rowObj = { ...newRows[r] };
          for (let c = startCol; c <= endCol; c++) {
            const colDef = currentSheet.columns[c];
            if (colDef) {
              const prevStyle = rowObj[colDef.id]?.style || {};
              rowObj[colDef.id] = {
                ...rowObj[colDef.id],
                style: {
                  ...prevStyle,
                  ...style,
                  bold: style.bold !== undefined ? !prevStyle.bold : prevStyle.bold,
                  italic: style.italic !== undefined ? !prevStyle.italic : prevStyle.italic,
                },
              };
            }
          }
          newRows[r] = rowObj;
        }

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, rows: newRows };
        return { ...prev, sheets: updatedSheets };
      });
    },
    [selection, activeCell, workbook, pushUndoSnapshot]
  );

  // Row operations (Insert above/below, Delete)
  const handleInsertRow = useCallback(
    (position: 'above' | 'below', referenceRow?: number) => {
      const targetRow = referenceRow !== undefined ? referenceRow : activeCell.rowIdx;
      const insertIndex = position === 'above' ? targetRow : targetRow + 1;

      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newRows = [...currentSheet.rows];

        const emptyRow: any = {};
        currentSheet.columns.forEach((c) => {
          emptyRow[c.id] = { value: '' };
        });

        newRows.splice(insertIndex, 0, emptyRow);

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, rows: newRows };
        return { ...prev, sheets: updatedSheets };
      });

      setActiveCell((prev) => ({ ...prev, rowIdx: insertIndex }));
    },
    [activeCell.rowIdx, workbook, pushUndoSnapshot]
  );

  const handleDeleteRow = useCallback(
    (rowIdx?: number) => {
      const targetRow = rowIdx !== undefined ? rowIdx : activeCell.rowIdx;
      if (activeSheet.rows.length <= 1) return;

      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newRows = [...currentSheet.rows];

        newRows.splice(targetRow, 1);

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, rows: newRows };
        return { ...prev, sheets: updatedSheets };
      });

      if (activeCell.rowIdx >= activeSheet.rows.length - 1) {
        setActiveCell((prev) => ({ ...prev, rowIdx: Math.max(0, prev.rowIdx - 1) }));
      }
    },
    [activeCell.rowIdx, activeSheet.rows.length, workbook, pushUndoSnapshot]
  );

  // Column operations (Add, Rename, Delete, Reorder, Resize)
  const handleAddColumn = useCallback(
    (name: string, type: ColumnDef['type'] = 'text', width = 160) => {
      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];

        const newColId = `col_${Date.now()}`;
        const newCol: ColumnDef = {
          id: newColId,
          name,
          type,
          width,
        };

        const newColumns = [...currentSheet.columns, newCol];
        const newRows = currentSheet.rows.map((r) => ({
          ...r,
          [newColId]: { value: '' },
        }));

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = {
          ...currentSheet,
          columns: newColumns,
          rows: newRows,
        };

        return { ...prev, sheets: updatedSheets };
      });
    },
    [workbook, pushUndoSnapshot]
  );

  const handleRenameColumn = useCallback(
    (colId: string, newName: string) => {
      pushUndoSnapshot(workbook);
      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newCols = currentSheet.columns.map((c) => (c.id === colId ? { ...c, name: newName } : c));
        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, columns: newCols };
        return { ...prev, sheets: updatedSheets };
      });
    },
    [workbook, pushUndoSnapshot]
  );

  const handleDeleteColumn = useCallback(
    (colId: string) => {
      if (activeSheet.columns.length <= 1) return;
      pushUndoSnapshot(workbook);
      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newCols = currentSheet.columns.filter((c) => c.id !== colId);
        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, columns: newCols };
        return { ...prev, sheets: updatedSheets };
      });
    },
    [activeSheet.columns.length, workbook, pushUndoSnapshot]
  );

  const handleReorderColumns = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      pushUndoSnapshot(workbook);
      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];
        const newCols = [...currentSheet.columns];
        const [moved] = newCols.splice(fromIdx, 1);
        newCols.splice(toIdx, 0, moved);

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, columns: newCols };
        return { ...prev, sheets: updatedSheets };
      });
    },
    [workbook, pushUndoSnapshot]
  );

  const handleResizeColumn = useCallback((colId: string, width: number) => {
    setWorkbook((prev) => {
      const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
      if (currentSheetIndex === -1) return prev;
      const currentSheet = prev.sheets[currentSheetIndex];
      const newCols = currentSheet.columns.map((c) => (c.id === colId ? { ...c, width } : c));
      const updatedSheets = [...prev.sheets];
      updatedSheets[currentSheetIndex] = { ...currentSheet, columns: newCols };
      return { ...prev, sheets: updatedSheets };
    });
  }, []);

  const handleResizeRow = useCallback((rowIdx: number, height: number) => {
    setWorkbook((prev) => {
      const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
      if (currentSheetIndex === -1) return prev;
      const currentSheet = prev.sheets[currentSheetIndex];
      const rowHeights = { ...(currentSheet.rowHeights || {}), [rowIdx]: height };
      const updatedSheets = [...prev.sheets];
      updatedSheets[currentSheetIndex] = { ...currentSheet, rowHeights };
      return { ...prev, sheets: updatedSheets };
    });
  }, []);

  // Sort Active Column
  const handleSortColumn = useCallback(
    (direction: 'asc' | 'desc') => {
      const targetCol = activeSheet.columns[activeCell.colIdx];
      if (!targetCol) return;
      pushUndoSnapshot(workbook);

      setWorkbook((prev) => {
        const currentSheetIndex = prev.sheets.findIndex((s) => s.id === prev.activeSheetId);
        if (currentSheetIndex === -1) return prev;
        const currentSheet = prev.sheets[currentSheetIndex];

        const sortedRows = [...currentSheet.rows].sort((a, b) => {
          const valA = a[targetCol.id]?.value ?? '';
          const valB = b[targetCol.id]?.value ?? '';
          if (valA === valB) return 0;
          if (valA === '') return 1;
          if (valB === '') return -1;
          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            return direction === 'asc' ? numA - numB : numB - numA;
          }
          return direction === 'asc'
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
        });

        const updatedSheets = [...prev.sheets];
        updatedSheets[currentSheetIndex] = { ...currentSheet, rows: sortedRows };
        return { ...prev, sheets: updatedSheets };
      });
    },
    [activeSheet.columns, activeCell.colIdx, workbook, pushUndoSnapshot]
  );

  // Sheet Tabs Management
  const handleAddSheet = useCallback(() => {
    pushUndoSnapshot(workbook);
    const dateStr = new Date().toISOString().slice(0, 10).split('-').reverse().join('.');
    const sheetNum = workbook.sheets.length + 1;
    const newSheet: SheetData = {
      id: `sheet_${Date.now()}`,
      name: `${dateStr} (${sheetNum})`,
      columns: [
        { id: 'col_0', name: 'SR NUM', width: 80, type: 'number' },
        { id: 'col_1', name: 'TRN NUM', width: 130, type: 'text' },
        { id: 'col_2', name: 'INV NUM', width: 130, type: 'text' },
        { id: 'col_3', name: 'PARTY', width: 250, type: 'text' },
        { id: 'col_4', name: 'SELLER', width: 160, type: 'text' },
        {
          id: 'col_5',
          name: 'REMARK',
          width: 170,
          type: 'select',
          options: ['PENDING', 'PRINT', 'BACKDATED', 'UPLOADED', 'CANCELLATION'],
        },
        { id: 'col_6', name: 'INSTRUCTIONS', width: 260, type: 'text' },
      ],
      rows: Array.from({ length: 50 }, (_, i) => ({
        col_0: { value: i + 1 },
        col_1: { value: '' },
        col_2: { value: '' },
        col_3: { value: '' },
        col_4: { value: '' },
        col_5: { value: '' },
        col_6: { value: '' },
      })),
      color: '#0284c7',
      isFrozenHeader: true,
    };

    setWorkbook((prev) => ({
      ...prev,
      sheets: [...prev.sheets, newSheet],
      activeSheetId: newSheet.id,
    }));
  }, [workbook, pushUndoSnapshot]);

  const handleRenameSheet = useCallback(
    (id: string, newName: string) => {
      pushUndoSnapshot(workbook);
      setWorkbook((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => (s.id === id ? { ...s, name: newName } : s)),
      }));
    },
    [workbook, pushUndoSnapshot]
  );

  const handleDuplicateSheet = useCallback(
    (id: string) => {
      const source = workbook.sheets.find((s) => s.id === id);
      if (!source) return;
      pushUndoSnapshot(workbook);
      const dupSheet: SheetData = {
        ...source,
        id: `sheet_dup_${Date.now()}`,
        name: `${source.name} (Copy)`,
      };
      setWorkbook((prev) => ({
        ...prev,
        sheets: [...prev.sheets, dupSheet],
        activeSheetId: dupSheet.id,
      }));
    },
    [workbook, pushUndoSnapshot]
  );

  const handleDeleteSheet = useCallback(
    (id: string) => {
      if (workbook.sheets.length <= 1) return;
      pushUndoSnapshot(workbook);
      setWorkbook((prev) => {
        const remaining = prev.sheets.filter((s) => s.id !== id);
        return {
          ...prev,
          sheets: remaining,
          activeSheetId: remaining[0].id,
        };
      });
    },
    [workbook, pushUndoSnapshot]
  );

  const handleChangeTabColor = useCallback(
    (id: string, color: string) => {
      setWorkbook((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => (s.id === id ? { ...s, color } : s)),
      }));
    },
    []
  );

  // Control Center Rule Handlers
  const handleAddPartyRule = useCallback((rule: Omit<PartyRule, 'id' | 'updatedAt'>) => {
    const newRule: PartyRule = {
      ...rule,
      id: `pr_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    setWorkbook((prev) => ({
      ...prev,
      controlCenterRules: [newRule, ...prev.controlCenterRules],
    }));
  }, []);

  const handleUpdatePartyRule = useCallback((id: string, updates: Partial<PartyRule>) => {
    setWorkbook((prev) => ({
      ...prev,
      controlCenterRules: prev.controlCenterRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const handleDeletePartyRule = useCallback((id: string) => {
    setWorkbook((prev) => ({
      ...prev,
      controlCenterRules: prev.controlCenterRules.filter((r) => r.id !== id),
    }));
  }, []);

  const handleTogglePartyRule = useCallback((id: string) => {
    setWorkbook((prev) => ({
      ...prev,
      controlCenterRules: prev.controlCenterRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));
  }, []);

  // Automations Handlers
  const handleAddAutomation = useCallback((rule: Omit<AutomationRule, 'id'>) => {
    const newAuto: AutomationRule = {
      ...rule,
      id: `auto_${Date.now()}`,
    };
    setWorkbook((prev) => ({
      ...prev,
      automations: [newAuto, ...prev.automations],
    }));
  }, []);

  const handleToggleAutomation = useCallback((id: string) => {
    setWorkbook((prev) => ({
      ...prev,
      automations: prev.automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    }));
  }, []);

  const handleDeleteAutomation = useCallback((id: string) => {
    setWorkbook((prev) => ({
      ...prev,
      automations: prev.automations.filter((a) => a.id !== id),
    }));
  }, []);

  // Jump to cell from search or lookup
  const handleNavigateToCell = useCallback((sheetId: string, colIdx: number, rowIdx: number) => {
    setWorkbook((prev) => ({ ...prev, activeSheetId: sheetId }));
    setActiveCell({ colIdx, rowIdx });
    setSelection(null);
    setActiveSection('workspace');
  }, []);

  // Active cell data for FormulaBar & Toolbar
  const activeColDef = activeSheet.columns[activeCell.colIdx];
  const activeCellData = activeSheet.rows[activeCell.rowIdx]?.[activeColDef?.id];
  const currentCellValue = activeCellData?.formula || String(activeCellData?.value ?? '');

  // Active row dictionary for AI context
  const activeRowObj: Record<string, any> = {};
  if (activeSheet.rows[activeCell.rowIdx]) {
    activeSheet.columns.forEach((c) => {
      activeRowObj[c.name] = activeSheet.rows[activeCell.rowIdx]?.[c.id]?.value ?? '';
    });
  }

  // Dimension text for selection e.g. "3R x 2C"
  const selectionDimText = selection
    ? `${Math.abs(selection.endRow - selection.startRow) + 1}R × ${
        Math.abs(selection.endCol - selection.startCol) + 1
      }C`
    : undefined;

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${workbook.settings.theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-neutral-100'}`}>
      {/* 1. TOP APPLICATION NAVIGATION BAR */}
      <header className="h-12 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-3 select-none shrink-0 z-30">
        {/* Left: Branding & Main Navigation Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <span className="font-mono font-black text-white text-sm tracking-wider">XL</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-tight text-white text-sm">PROJECT XL</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-cyan-400 font-mono font-semibold border border-neutral-700">
                  v2.0 PRO
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 block -mt-0.5">Spreadsheet & Automation Control Center</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-neutral-800 mx-2" />

          {/* Section Navigation Tabs */}
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => setActiveSection('workspace')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === 'workspace'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>

            <button
              onClick={() => setActiveSection('control_center')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === 'control_center'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Control Center</span>
              <span className="text-[9px] px-1 bg-cyan-950 text-cyan-300 rounded font-mono">
                {workbook.controlCenterRules.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('automation')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === 'automation'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Automation Studio</span>
              <span className="text-[9px] px-1 bg-amber-950 text-amber-300 rounded font-mono">
                {workbook.automations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('data_manager')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === 'data_manager'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data Manager</span>
            </button>

            <button
              onClick={() => setActiveSection('settings')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSection === 'settings'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Right Tools: Global Search, Quick Excel Export, Intelligence Suite */}
        <div className="flex items-center space-x-2">
          {/* Global Search Shortcut */}
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="hidden sm:flex items-center space-x-2 px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 text-xs transition"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">Search</span>
            <kbd className="text-[10px] bg-neutral-800 px-1 py-0.5 rounded text-neutral-400 font-mono">Ctrl+K</kbd>
          </button>

          {/* Quick Excel Export button */}
          <button
            onClick={() => exportToExcel(workbook, `Project_XL_${activeSheet.name}.xlsx`)}
            title="Download full workbook as Microsoft Excel .xlsx"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export Excel</span>
          </button>

          {/* Gemini AI Suite Trigger Button */}
          <button
            onClick={() => {
              setAiModalDefaultTab('chat');
              setIsAiModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-900/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span className="hidden md:inline">Gemini Intelligence</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {activeSection === 'workspace' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <SpreadsheetToolbar
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onCut={handleCut}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onFormatStyle={handleFormatStyle}
              onInsertRow={handleInsertRow}
              onDeleteRow={handleDeleteRow}
              onAddColumn={() => setIsColumnManagerOpen(true)}
              onDeleteColumn={() => {
                if (activeColDef && confirm(`Delete column "${activeColDef.name}"?`)) {
                  handleDeleteColumn(activeColDef.id);
                }
              }}
              onSortColumn={handleSortColumn}
              onOpenSearch={() => setIsSearchModalOpen(true)}
              onSaveManual={() => {
                saveWorkbookToLocal(workbook);
                backupWorkbookToServer(workbook);
                setSaveStatus('saved');
              }}
              onSpeakSelection={() => {
                setAiModalDefaultTab('tts');
                setIsAiModalOpen(true);
              }}
              onManageColumns={() => setIsColumnManagerOpen(true)}
              saveStatus={saveStatus}
            />

            {/* Formula Bar */}
            <FormulaBar
              selectedCoord={activeCell}
              cellValue={currentCellValue}
              columnName={activeColDef?.name}
              selectionDimText={selectionDimText}
              onCommit={(newVal) => {
                if (activeColDef) {
                  let formula: string | undefined;
                  let finalVal: any = newVal;
                  if (newVal.startsWith('=')) {
                    formula = newVal;
                    finalVal = evaluateFormula(newVal, activeSheet).value;
                  }
                  handleUpdateCellValue(activeCell.rowIdx, activeColDef.id, finalVal, formula);
                }
              }}
            />

            {/* Spreadsheet Grid Canvas */}
            <SpreadsheetGrid
              sheet={activeSheet}
              activeCell={activeCell}
              selection={selection}
              zoom={zoom}
              conditionalFormats={workbook.conditionalFormats}
              partyRules={getEffectivePartyRules(workbook)}
              onSelectCell={handleSelectCell}
              onSetSelection={setSelection}
              onUpdateCellValue={handleUpdateCellValue}
              onResizeColumn={handleResizeColumn}
              onResizeRow={handleResizeRow}
              onInsertRow={handleInsertRow}
              onDeleteRow={handleDeleteRow}
              onInsertColumn={(idx, name) => handleAddColumn(name)}
              onDeleteColumn={handleDeleteColumn}
              onReorderColumns={handleReorderColumns}
              onCut={handleCut}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onClearSelection={handleClearSelection}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onSaveManual={() => {
                saveWorkbookToLocal(workbook);
                backupWorkbookToServer(workbook);
              }}
              onOpenFormulaEdit={() => {}}
            />

            {/* Sheet Tabs & Statistics Bar */}
            <SheetTabsBar
              sheets={workbook.sheets}
              activeSheetId={workbook.activeSheetId}
              selection={selection}
              activeCell={activeCell}
              zoom={zoom}
              onSelectSheet={(id) => {
                setWorkbook((prev) => ({ ...prev, activeSheetId: id }));
                setActiveCell({ colIdx: 0, rowIdx: 0 });
                setSelection(null);
              }}
              onAddSheet={handleAddSheet}
              onRenameSheet={handleRenameSheet}
              onDuplicateSheet={handleDuplicateSheet}
              onDeleteSheet={handleDeleteSheet}
              onChangeTabColor={handleChangeTabColor}
              onChangeZoom={setZoom}
            />
          </div>
        )}

        {activeSection === 'control_center' && (
          <ControlCenterView
            partyRules={getEffectivePartyRules(workbook)}
            onAddRule={handleAddPartyRule}
            onUpdateRule={handleUpdatePartyRule}
            onDeleteRule={handleDeletePartyRule}
            onToggleRule={handleTogglePartyRule}
          />
        )}

        {activeSection === 'automation' && (
          <AutomationStudioView
            automations={workbook.automations}
            auditLogs={workbook.auditLogs}
            sheets={workbook.sheets}
            onAddAutomation={handleAddAutomation}
            onToggleAutomation={handleToggleAutomation}
            onDeleteAutomation={handleDeleteAutomation}
            onClearAuditLogs={() => setWorkbook((p) => ({ ...p, auditLogs: [] }))}
          />
        )}

        {activeSection === 'data_manager' && (
          <DataManagerView
            workbook={workbook}
            activeSheet={activeSheet}
            onImportSheets={(imported) => {
              pushUndoSnapshot(workbook);
              setWorkbook((prev) => ({
                ...prev,
                sheets: [...prev.sheets, ...imported],
                activeSheetId: imported[0].id,
              }));
              setActiveSection('workspace');
            }}
            onRestoreWorkbook={(restored) => {
              pushUndoSnapshot(workbook);
              setWorkbook(restored);
            }}
            onResetToDefault={() => {
              const initial = getInitialWorkbook();
              setWorkbook(initial);
              saveWorkbookToLocal(initial);
            }}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsView
            settings={workbook.settings}
            onUpdateSettings={(updates) =>
              setWorkbook((prev) => ({ ...prev, settings: { ...prev.settings, ...updates } }))
            }
            onResetAllData={() => {
              const initial = getInitialWorkbook();
              setWorkbook(initial);
              saveWorkbookToLocal(initial);
            }}
          />
        )}
      </main>

      {/* MODALS */}
      {/* 1. Gemini AI Suite Modal */}
      <GeminiAIAssistantModal
        isOpen={isAiModalOpen}
        activeSheet={activeSheet}
        activeRowData={activeRowObj}
        defaultTab={aiModalDefaultTab}
        onClose={() => setIsAiModalOpen(false)}
      />

      {/* 2. Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        sheets={workbook.sheets}
        onClose={() => setIsSearchModalOpen(false)}
        onNavigateToCell={handleNavigateToCell}
      />

      {/* 3. Column Manager Modal */}
      <ColumnManagerModal
        isOpen={isColumnManagerOpen}
        sheet={activeSheet}
        onClose={() => setIsColumnManagerOpen(false)}
        onAddColumn={handleAddColumn}
        onRenameColumn={handleRenameColumn}
        onDeleteColumn={handleDeleteColumn}
        onReorderColumns={handleReorderColumns}
      />
    </div>
  );
}
