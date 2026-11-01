import * as XLSX from 'xlsx';
import { WorkbookState, SheetData, ColumnDef, SheetRow } from '../types';
import { getInitialWorkbook } from '../data/initialData';

const LOCAL_STORAGE_KEY = 'PROJECT_XL_WORKBOOK_DATA_v1';

export function loadSavedWorkbook(): WorkbookState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load from localStorage, falling back to default dataset:', err);
  }
  return getInitialWorkbook();
}

export function saveWorkbookToLocal(state: WorkbookState): boolean {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    return false;
  }
}

export async function backupWorkbookToServer(state: WorkbookState): Promise<boolean> {
  try {
    const res = await fetch('/api/storage/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workbookData: state }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Server backup failed:', err);
    return false;
  }
}

export async function restoreWorkbookFromServer(): Promise<WorkbookState | null> {
  try {
    const res = await fetch('/api/storage/restore');
    if (res.ok) {
      const data = await res.json();
      if (data.found && data.workbookData) {
        return data.workbookData;
      }
    }
  } catch (err) {
    console.warn('Server restore failed:', err);
  }
  return null;
}

/**
 * Exports current workbook state to real Microsoft Excel (.xlsx) file
 */
export function exportToExcel(state: WorkbookState, filename = 'Project_XL_Export.xlsx') {
  const wb = XLSX.utils.book_new();

  for (const sheet of state.sheets) {
    if (sheet.hidden) continue;

    // Header row
    const headers = sheet.columns.map((c) => c.name);
    const rowsData: any[][] = [headers];

    for (const row of sheet.rows) {
      // Check if row has any non-empty cells
      const hasContent = sheet.columns.some((c) => {
        const val = row[c.id]?.value;
        return val !== null && val !== undefined && val !== '';
      });

      if (hasContent) {
        const rowVals = sheet.columns.map((c) => {
          const cell = row[c.id];
          return cell ? cell.value ?? '' : '';
        });
        rowsData.push(rowVals);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rowsData);

    // Set column widths in Excel sheet
    ws['!cols'] = sheet.columns.map((c) => ({ wch: Math.max(12, Math.floor(c.width / 8)) }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel 31-char sheet name limit
  }

  XLSX.writeFile(wb, filename);
}

/**
 * Exports active sheet to CSV
 */
export function exportToCSV(sheet: SheetData, filename = 'Project_XL_Sheet.csv') {
  const headers = sheet.columns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(',');
  const lines: string[] = [headers];

  for (const row of sheet.rows) {
    const hasContent = sheet.columns.some((c) => row[c.id]?.value);
    if (!hasContent) continue;
    const rowVals = sheet.columns.map((c) => {
      const val = row[c.id]?.value ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(rowVals.join(','));
  }

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Parses an uploaded Excel or CSV file into SheetData structures
 */
export async function importExcelFile(file: File): Promise<SheetData[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const newSheets: SheetData[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (jsonData.length === 0) continue;

    const rawHeaders = (jsonData[0] || []).map((h, i) => String(h || `Column ${i + 1}`).trim());
    const columns: ColumnDef[] = rawHeaders.map((name, i) => ({
      id: `col_${i}`,
      name: name || `Column ${i + 1}`,
      width: Math.max(120, name.length * 12),
      type: 'text',
    }));

    const rows: SheetRow[] = [];
    for (let r = 1; r < jsonData.length; r++) {
      const rowItem: SheetRow = {};
      const rowVals = jsonData[r] || [];
      columns.forEach((col, cIdx) => {
        rowItem[col.id] = { value: rowVals[cIdx] !== undefined ? rowVals[cIdx] : '' };
      });
      rows.push(rowItem);
    }

    // Pad with empty rows to at least 50
    for (let r = rows.length; r < 50; r++) {
      const emptyRow: SheetRow = {};
      columns.forEach((col) => {
        emptyRow[col.id] = { value: '' };
      });
      rows.push(emptyRow);
    }

    newSheets.push({
      id: `sheet_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: sheetName,
      columns,
      rows,
      color: '#0284c7',
      isFrozenHeader: true,
    });
  }

  return newSheets;
}
