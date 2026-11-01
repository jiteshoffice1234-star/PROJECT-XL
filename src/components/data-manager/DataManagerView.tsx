import React, { useState } from 'react';
import { WorkbookState, SheetData } from '../../types';
import { exportToExcel, exportToCSV, importExcelFile, backupWorkbookToServer } from '../../utils/storage';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Copy,
} from 'lucide-react';

interface DataManagerViewProps {
  workbook: WorkbookState;
  activeSheet: SheetData;
  onImportSheets: (sheets: SheetData[]) => void;
  onRestoreWorkbook: (state: WorkbookState) => void;
  onResetToDefault: () => void;
}

export const DataManagerView: React.FC<DataManagerViewProps> = ({
  workbook,
  activeSheet,
  onImportSheets,
  onRestoreWorkbook,
  onResetToDefault,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportStatus('Parsing Excel workbook...');
      const importedSheets = await importExcelFile(file);
      if (importedSheets.length > 0) {
        onImportSheets(importedSheets);
        setImportStatus(`Successfully imported ${importedSheets.length} sheet(s) from "${file.name}"!`);
      } else {
        setImportStatus('No valid sheets found in uploaded file.');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setImportStatus(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(workbook, `Project_XL_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    exportToCSV(activeSheet, `${activeSheet.name}_export.csv`);
  };

  const handleDownloadJSONBackup = () => {
    const jsonStr = JSON.stringify(workbook, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project_xl_backup_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.sheets && Array.isArray(parsed.sheets)) {
          onRestoreWorkbook(parsed);
          alert('Workbook restored successfully from backup!');
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleServerBackup = async () => {
    setIsBackingUp(true);
    const success = await backupWorkbookToServer(workbook);
    setIsBackingUp(false);
    if (success) {
      alert('Snapshot backed up to backend server storage successfully!');
    } else {
      alert('Server backup failed.');
    }
  };

  // Find duplicate invoice numbers in active sheet
  const invCol = activeSheet.columns.find((c) => c.name.toUpperCase() === 'INV NUM');
  const duplicateInvoices = React.useMemo(() => {
    if (!invCol) return [];
    const counts = new Map<string, number[]>();
    activeSheet.rows.forEach((r, idx) => {
      const val = String(r[invCol.id]?.value || '').trim();
      if (val) {
        counts.set(val, [...(counts.get(val) || []), idx + 1]);
      }
    });
    const dups: { inv: string; rows: number[] }[] = [];
    counts.forEach((rows, inv) => {
      if (rows.length > 1) dups.push({ inv, rows });
    });
    return dups;
  }, [activeSheet, invCol]);

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-neutral-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Data & File Manager</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Import, export, backup, restore, and audit workbook integrity with Microsoft Excel compatibility.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel Import Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Import Excel or CSV Workbook</h2>
          </div>
          <p className="text-xs text-neutral-400">
            Upload an existing Microsoft Excel (.xlsx, .xls) or .csv file. All sheets, columns, and rows will be imported and ready for spreadsheet operations.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 hover:border-cyan-500 rounded-lg p-6 cursor-pointer bg-neutral-950/60 transition group">
            <FileSpreadsheet className="w-8 h-8 text-neutral-500 group-hover:text-cyan-400 mb-2 transition" />
            <span className="text-xs text-neutral-300 font-medium">Click to select file or drag & drop</span>
            <span className="text-[10px] text-neutral-500 mt-1">Supports .xlsx, .xls, .csv</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {isImporting && (
            <div className="flex items-center space-x-2 text-xs text-cyan-400">
              <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>{importStatus}</span>
            </div>
          )}

          {importStatus && !isImporting && (
            <div className="p-3 bg-neutral-950 rounded border border-neutral-800 text-xs text-neutral-300">
              {importStatus}
            </div>
          )}
        </div>

        {/* Excel Export Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Export to Microsoft Excel</h2>
          </div>
          <p className="text-xs text-neutral-400">
            Download your entire Project XL workbook with all sheets, custom column widths, and preserved values into a standard Excel file.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleExportExcel}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Full Workbook (.XLSX)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700 transition"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Current Sheet ({activeSheet.name}) as CSV</span>
            </button>
          </div>
        </div>

        {/* Snapshot & Cloud Persistence */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Persistent Storage & Snapshots</h2>
          </div>
          <p className="text-xs text-neutral-400">
            PROJECT XL automatically persists changes locally. You can also trigger an instant snapshot to server disk or download a portable JSON backup.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleServerBackup}
              disabled={isBackingUp}
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 transition"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isBackingUp ? 'Saving...' : 'Server Snapshot'}</span>
            </button>

            <button
              onClick={handleDownloadJSONBackup}
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium border border-neutral-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Download JSON</span>
            </button>
          </div>

          <div className="pt-2">
            <label className="block text-[11px] text-neutral-400 mb-1">Restore from Backup JSON:</label>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreJSONFile}
              className="text-xs text-neutral-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Integrity & Duplicate Scanner Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Data Integrity & Duplicate Scanner</h2>
          </div>
          <p className="text-xs text-neutral-400">
            Audits the active register ({activeSheet.name}) for duplicate invoice numbers and structural anomalies.
          </p>

          {duplicateInvoices.length === 0 ? (
            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 flex items-center space-x-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>All invoice numbers in "{activeSheet.name}" are unique! No duplicates detected.</span>
            </div>
          ) : (
            <div className="bg-neutral-950 p-3 rounded-lg border border-rose-900/50 space-y-2">
              <span className="text-xs font-bold text-rose-400">
                {duplicateInvoices.length} Duplicate Invoice Numbers Detected:
              </span>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {duplicateInvoices.map((d) => (
                  <div
                    key={d.inv}
                    className="flex items-center justify-between text-xs bg-rose-950/40 px-2 py-1 rounded border border-rose-800/40 font-mono text-rose-200"
                  >
                    <span>{d.inv}</span>
                    <span className="text-[10px] text-neutral-400">Found on rows: {d.rows.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => {
                if (confirm('Reset to the initial Project XL workbook dataset? Current unsaved changes will be replaced.')) {
                  onResetToDefault();
                }
              }}
              className="text-xs text-neutral-500 hover:text-rose-400 transition flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Workbook to Initial Factory Dataset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
