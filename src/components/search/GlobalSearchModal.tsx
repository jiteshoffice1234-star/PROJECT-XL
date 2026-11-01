import React, { useState, useMemo } from 'react';
import { SheetData } from '../../types';
import { Search, X, ArrowRight, Table } from 'lucide-react';
import { indexToColLetter } from '../../utils/formulaEngine';

interface GlobalSearchModalProps {
  isOpen: boolean;
  sheets: SheetData[];
  onClose: () => void;
  onNavigateToCell: (sheetId: string, colIdx: number, rowIdx: number) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  sheets,
  onClose,
  onNavigateToCell,
}) => {
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];

    const cleanQuery = query.toLowerCase().trim();
    const results: {
      sheetId: string;
      sheetName: string;
      colIdx: number;
      colName: string;
      rowIdx: number;
      cellCoord: string;
      value: string;
    }[] = [];

    for (const sheet of sheets) {
      if (sheet.hidden) continue;
      sheet.rows.forEach((row, rowIdx) => {
        sheet.columns.forEach((col, colIdx) => {
          const cell = row[col.id];
          const valStr = cell && cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
          if (valStr.toLowerCase().includes(cleanQuery)) {
            results.push({
              sheetId: sheet.id,
              sheetName: sheet.name,
              colIdx,
              colName: col.name,
              rowIdx,
              cellCoord: `${indexToColLetter(colIdx)}${rowIdx + 1}`,
              value: valStr,
            });
          }
        });
      });
    }

    return results.slice(0, 50); // limit to 50 results
  }, [query, sheets]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-neutral-800 flex items-center space-x-3 bg-neutral-950">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice numbers, party names, sellers, remarks across all sheets... (e.g. RATNA, AKSHAT, 1042)"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-neutral-500 font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 text-xs divide-y divide-neutral-800/40">
          {query.trim().length < 2 ? (
            <div className="p-8 text-center text-neutral-500">
              Type at least 2 characters to search across all sheets in the workbook.
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              No matching records found for "{query}".
            </div>
          ) : (
            searchResults.map((res, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onNavigateToCell(res.sheetId, res.colIdx, res.rowIdx);
                  onClose();
                }}
                className="p-3 hover:bg-neutral-800/70 rounded-lg cursor-pointer flex items-center justify-between transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 bg-neutral-800 rounded border border-neutral-700 text-cyan-400 font-mono text-[11px] font-bold">
                    {res.cellCoord}
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300 transition">
                      {res.value}
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center space-x-2 mt-0.5">
                      <span className="text-cyan-400 font-medium">{res.sheetName}</span>
                      <span>•</span>
                      <span>Column: {res.colName}</span>
                      <span>•</span>
                      <span>Row: {res.rowIdx + 1}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 text-neutral-500 group-hover:text-cyan-400 text-xs font-medium">
                  <span>Jump to Cell</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Helper */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between font-mono">
          <span>{searchResults.length} results found</span>
          <span>Press ESC or click close to dismiss</span>
        </div>
      </div>
    </div>
  );
};
