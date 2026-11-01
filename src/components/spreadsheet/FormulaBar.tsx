import React, { useState, useEffect } from 'react';
import { Check, X, FunctionSquare } from 'lucide-react';
import { indexToColLetter } from '../../utils/formulaEngine';

interface FormulaBarProps {
  selectedCoord: { colIdx: number; rowIdx: number } | null;
  cellValue: string;
  columnName?: string;
  selectionDimText?: string;
  onCommit: (newValue: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  selectedCoord,
  cellValue,
  columnName,
  selectionDimText,
  onCommit,
}) => {
  const [inputValue, setInputValue] = useState(cellValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setInputValue(cellValue);
    setIsEditing(false);
  }, [cellValue, selectedCoord]);

  const cellRefText = selectedCoord
    ? `${indexToColLetter(selectedCoord.colIdx)}${selectedCoord.rowIdx + 1}`
    : 'A1';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onCommit(inputValue);
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setInputValue(cellValue);
      setIsEditing(false);
    }
  };

  const handleApply = () => {
    onCommit(inputValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(cellValue);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center h-9 bg-neutral-900 border-b border-neutral-800 px-2 text-xs font-mono select-none">
      {/* Name Box */}
      <div className="flex items-center justify-between w-28 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-neutral-300 font-semibold shadow-inner mr-2">
        <span className="text-cyan-400 font-bold">{cellRefText}</span>
        {selectionDimText ? (
          <span className="text-[10px] text-neutral-500 font-sans">{selectionDimText}</span>
        ) : columnName ? (
          <span className="text-[10px] text-neutral-500 truncate max-w-[48px] font-sans" title={columnName}>
            {columnName}
          </span>
        ) : null}
      </div>

      {/* Function icon / Cancel / Confirm buttons */}
      <div className="flex items-center space-x-1 mr-2 border-r border-neutral-800 pr-2">
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              title="Cancel (Esc)"
              className="p-1 text-rose-400 hover:bg-neutral-800 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleApply}
              title="Commit (Enter)"
              className="p-1 text-emerald-400 hover:bg-neutral-800 rounded transition"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <span className="p-1 text-neutral-400 cursor-default" title="Formula Bar (type = for formulas)">
            <FunctionSquare className="w-4 h-4 text-cyan-400" />
          </span>
        )}
      </div>

      {/* Formula Input */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsEditing(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditing(true)}
          placeholder="Enter text or formula starting with = (e.g. =SUM(A1:A10), =IF(...))"
          className="w-full bg-neutral-950 text-neutral-100 px-3 py-1 text-xs border border-neutral-800 rounded focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition placeholder-neutral-600 font-sans"
        />
      </div>
    </div>
  );
};
