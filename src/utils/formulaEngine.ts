import { SheetData } from '../types';

/**
 * Converts column letter(s) to 0-based column index
 * e.g., 'A' -> 0, 'B' -> 1, 'Z' -> 25, 'AA' -> 26
 */
export function colLetterToIndex(colStr: string): number {
  let index = 0;
  const upper = colStr.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Converts 0-based column index to letter(s)
 * e.g., 0 -> 'A', 25 -> 'Z', 26 -> 'AA'
 */
export function indexToColLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Parses coordinate like "A1", "C12", "col_3"
 */
export function parseCellCoord(coord: string): { colIdx: number; rowIdx: number } | null {
  const match = coord.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const colIdx = colLetterToIndex(match[1]);
  const rowIdx = parseInt(match[2], 10) - 1;
  return { colIdx, rowIdx };
}

/**
 * Parses range like "A1:B10"
 */
export function parseRange(rangeStr: string): { startCol: number; startRow: number; endCol: number; endRow: number } | null {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return null;
  const start = parseCellCoord(parts[0]);
  const end = parseCellCoord(parts[1]);
  if (!start || !end) return null;
  return {
    startCol: Math.min(start.colIdx, end.colIdx),
    startRow: Math.min(start.rowIdx, end.rowIdx),
    endCol: Math.max(start.colIdx, end.colIdx),
    endRow: Math.max(start.rowIdx, end.rowIdx),
  };
}

export function getCellValue(sheet: SheetData, colIdx: number, rowIdx: number): any {
  if (rowIdx < 0 || rowIdx >= sheet.rows.length) return null;
  if (colIdx < 0 || colIdx >= sheet.columns.length) return null;
  const colId = sheet.columns[colIdx]?.id;
  if (!colId) return null;
  const cell = sheet.rows[rowIdx]?.[colId];
  return cell ? cell.value : null;
}

/**
 * Evaluates Excel-style formula string
 */
export function evaluateFormula(formula: string, sheet: SheetData): { value: any; error?: string } {
  if (!formula.startsWith('=')) {
    return { value: formula };
  }

  const rawExpr = formula.substring(1).trim();

  try {
    // Check for function calls e.g. SUM(A1:A10)
    const fnMatch = rawExpr.match(/^([A-Z0-9_]+)\((.*)\)$/i);
    if (fnMatch) {
      const fnName = fnMatch[1].toUpperCase();
      const rawArgs = fnMatch[2];
      return evalFunction(fnName, rawArgs, sheet);
    }

    // Try cell reference e.g. =A1
    const cellCoord = parseCellCoord(rawExpr);
    if (cellCoord) {
      return { value: getCellValue(sheet, cellCoord.colIdx, cellCoord.rowIdx) };
    }

    // Evaluate basic arithmetic expression by replacing cell references
    let replacedExpr = rawExpr.replace(/\b([A-Za-z]+)(\d+)\b/g, (_match, colLetters, rowNum) => {
      const colIdx = colLetterToIndex(colLetters);
      const rowIdx = parseInt(rowNum, 10) - 1;
      const val = getCellValue(sheet, colIdx, rowIdx);
      if (val === null || val === undefined || val === '') return '0';
      const num = Number(val);
      return isNaN(num) ? `"${String(val).replace(/"/g, '\\"')}"` : String(num);
    });

    // Simple sanitized eval for arithmetic
    if (/^[0-9+\-*/().\s%"']+$/.test(replacedExpr)) {
      // replace % with / 100
      replacedExpr = replacedExpr.replace(/(\d+)%/g, '($1/100)');
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${replacedExpr})`)();
      return { value: result };
    }

    return { value: rawExpr };
  } catch (err: any) {
    return { value: '#ERROR!', error: err.message };
  }
}

/**
 * Splits comma-separated arguments while respecting nested parentheses and quotes
 */
function splitArgs(argStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < argStr.length; i++) {
    const char = argStr[i];
    if (char === '"' && argStr[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '(' && !inQuotes) {
      depth++;
      current += char;
    } else if (char === ')' && !inQuotes) {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0 && !inQuotes) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    args.push(current.trim());
  }
  return args;
}

function resolveArgValue(arg: string, sheet: SheetData): any {
  const trimmed = arg.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (!isNaN(Number(trimmed)) && trimmed !== '') {
    return Number(trimmed);
  }
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;

  // Function
  if (trimmed.includes('(') && trimmed.endsWith(')')) {
    return evaluateFormula('=' + trimmed, sheet).value;
  }

  // Cell reference
  const coord = parseCellCoord(trimmed);
  if (coord) {
    return getCellValue(sheet, coord.colIdx, coord.rowIdx);
  }

  return trimmed;
}

function getRangeValues(rangeStr: string, sheet: SheetData): any[] {
  const range = parseRange(rangeStr);
  if (!range) return [];
  const values: any[] = [];
  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      values.push(getCellValue(sheet, c, r));
    }
  }
  return values;
}

function evalFunction(name: string, rawArgs: string, sheet: SheetData): { value: any; error?: string } {
  const args = splitArgs(rawArgs);

  switch (name) {
    case 'SUM': {
      let sum = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          const vals = getRangeValues(arg, sheet);
          for (const v of vals) {
            const num = Number(v);
            if (!isNaN(num)) sum += num;
          }
        } else {
          const v = resolveArgValue(arg, sheet);
          const num = Number(v);
          if (!isNaN(num)) sum += num;
        }
      }
      return { value: sum };
    }

    case 'AVERAGE': {
      let sum = 0;
      let count = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          const vals = getRangeValues(arg, sheet);
          for (const v of vals) {
            const num = Number(v);
            if (!isNaN(num) && v !== null && v !== '') {
              sum += num;
              count++;
            }
          }
        } else {
          const v = resolveArgValue(arg, sheet);
          const num = Number(v);
          if (!isNaN(num) && v !== null && v !== '') {
            sum += num;
            count++;
          }
        }
      }
      return { value: count === 0 ? 0 : Math.round((sum / count) * 100) / 100 };
    }

    case 'COUNT': {
      let count = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          const vals = getRangeValues(arg, sheet);
          for (const v of vals) {
            if (typeof v === 'number' || (!isNaN(Number(v)) && v !== null && v !== '')) count++;
          }
        } else {
          const v = resolveArgValue(arg, sheet);
          if (typeof v === 'number' || (!isNaN(Number(v)) && v !== null && v !== '')) count++;
        }
      }
      return { value: count };
    }

    case 'COUNTA': {
      let count = 0;
      for (const arg of args) {
        if (arg.includes(':')) {
          const vals = getRangeValues(arg, sheet);
          for (const v of vals) {
            if (v !== null && v !== undefined && String(v).trim() !== '') count++;
          }
        } else {
          const v = resolveArgValue(arg, sheet);
          if (v !== null && v !== undefined && String(v).trim() !== '') count++;
        }
      }
      return { value: count };
    }

    case 'COUNTIF': {
      if (args.length < 2) return { value: '#N/A', error: 'COUNTIF requires 2 arguments' };
      const rangeValues = getRangeValues(args[0], sheet);
      const condition = resolveArgValue(args[1], sheet);
      let count = 0;
      for (const v of rangeValues) {
        if (String(v).trim().toLowerCase() === String(condition).trim().toLowerCase()) {
          count++;
        }
      }
      return { value: count };
    }

    case 'SUMIF': {
      if (args.length < 2) return { value: '#N/A', error: 'SUMIF requires at least 2 arguments' };
      const range = parseRange(args[0]);
      if (!range) return { value: 0 };
      const condition = resolveArgValue(args[1], sheet);
      const sumRange = args[2] ? parseRange(args[2]) : range;
      if (!sumRange) return { value: 0 };

      let sum = 0;
      const rowCount = Math.min(range.endRow - range.startRow + 1, sumRange.endRow - sumRange.startRow + 1);
      for (let i = 0; i < rowCount; i++) {
        const condVal = getCellValue(sheet, range.startCol, range.startRow + i);
        if (String(condVal).trim().toLowerCase() === String(condition).trim().toLowerCase()) {
          const sumVal = Number(getCellValue(sheet, sumRange.startCol, sumRange.startRow + i));
          if (!isNaN(sumVal)) sum += sumVal;
        }
      }
      return { value: sum };
    }

    case 'IF': {
      if (args.length < 2) return { value: '#N/A', error: 'IF requires condition and true value' };
      const condArg = args[0];
      // Evaluate condition
      let condResult = false;
      if (condArg.includes('=')) {
        const [left, right] = condArg.split('=');
        condResult = String(resolveArgValue(left, sheet)).trim().toLowerCase() === String(resolveArgValue(right, sheet)).trim().toLowerCase();
      } else if (condArg.includes('!=')) {
        const [left, right] = condArg.split('!=');
        condResult = String(resolveArgValue(left, sheet)).trim().toLowerCase() !== String(resolveArgValue(right, sheet)).trim().toLowerCase();
      } else if (condArg.includes('>=')) {
        const [left, right] = condArg.split('>=');
        condResult = Number(resolveArgValue(left, sheet)) >= Number(resolveArgValue(right, sheet));
      } else if (condArg.includes('<=')) {
        const [left, right] = condArg.split('<=');
        condResult = Number(resolveArgValue(left, sheet)) <= Number(resolveArgValue(right, sheet));
      } else if (condArg.includes('>')) {
        const [left, right] = condArg.split('>');
        condResult = Number(resolveArgValue(left, sheet)) > Number(resolveArgValue(right, sheet));
      } else if (condArg.includes('<')) {
        const [left, right] = condArg.split('<');
        condResult = Number(resolveArgValue(left, sheet)) < Number(resolveArgValue(right, sheet));
      } else {
        condResult = Boolean(resolveArgValue(condArg, sheet));
      }

      if (condResult) {
        return { value: resolveArgValue(args[1], sheet) };
      } else {
        return { value: args[2] ? resolveArgValue(args[2], sheet) : false };
      }
    }

    case 'AND': {
      for (const arg of args) {
        if (!resolveArgValue(arg, sheet)) return { value: false };
      }
      return { value: true };
    }

    case 'OR': {
      for (const arg of args) {
        if (resolveArgValue(arg, sheet)) return { value: true };
      }
      return { value: false };
    }

    case 'VLOOKUP': {
      if (args.length < 3) return { value: '#N/A', error: 'VLOOKUP requires 3+ args' };
      const lookupVal = resolveArgValue(args[0], sheet);
      const range = parseRange(args[1]);
      const colIndexOffset = Number(resolveArgValue(args[2], sheet)) - 1; // 1-based in Excel
      if (!range) return { value: '#REF!' };

      for (let r = range.startRow; r <= range.endRow; r++) {
        const key = getCellValue(sheet, range.startCol, r);
        if (String(key).trim().toLowerCase() === String(lookupVal).trim().toLowerCase()) {
          const targetCol = range.startCol + colIndexOffset;
          return { value: getCellValue(sheet, targetCol, r) };
        }
      }
      return { value: '#N/A' };
    }

    case 'XLOOKUP': {
      if (args.length < 3) return { value: '#N/A', error: 'XLOOKUP requires 3 args' };
      const lookupVal = resolveArgValue(args[0], sheet);
      const lookupRange = parseRange(args[1]);
      const returnRange = parseRange(args[2]);
      const notFoundVal = args[3] ? resolveArgValue(args[3], sheet) : '#N/A';
      if (!lookupRange || !returnRange) return { value: '#REF!' };

      const rowCount = lookupRange.endRow - lookupRange.startRow + 1;
      for (let i = 0; i < rowCount; i++) {
        const key = getCellValue(sheet, lookupRange.startCol, lookupRange.startRow + i);
        if (String(key).trim().toLowerCase() === String(lookupVal).trim().toLowerCase()) {
          return { value: getCellValue(sheet, returnRange.startCol, returnRange.startRow + i) };
        }
      }
      return { value: notFoundVal };
    }

    case 'IFERROR': {
      if (args.length < 2) return { value: '#N/A' };
      try {
        const res = resolveArgValue(args[0], sheet);
        if (res === '#ERROR!' || res === '#N/A' || res === '#REF!' || res === '#VALUE!') {
          return { value: resolveArgValue(args[1], sheet) };
        }
        return { value: res };
      } catch {
        return { value: resolveArgValue(args[1], sheet) };
      }
    }

    case 'CONCAT': {
      const parts = args.map((a) => String(resolveArgValue(a, sheet) ?? ''));
      return { value: parts.join('') };
    }

    case 'LEFT': {
      const text = String(resolveArgValue(args[0], sheet) ?? '');
      const count = args[1] ? Number(resolveArgValue(args[1], sheet)) : 1;
      return { value: text.slice(0, count) };
    }

    case 'RIGHT': {
      const text = String(resolveArgValue(args[0], sheet) ?? '');
      const count = args[1] ? Number(resolveArgValue(args[1], sheet)) : 1;
      return { value: text.slice(Math.max(0, text.length - count)) };
    }

    case 'MID': {
      const text = String(resolveArgValue(args[0], sheet) ?? '');
      const start = Number(resolveArgValue(args[1], sheet)) - 1; // 1-based in Excel
      const count = Number(resolveArgValue(args[2], sheet));
      return { value: text.slice(Math.max(0, start), start + count) };
    }

    case 'TODAY': {
      const now = new Date();
      return { value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` };
    }

    case 'DATE': {
      const y = Number(resolveArgValue(args[0], sheet));
      const m = Number(resolveArgValue(args[1], sheet));
      const d = Number(resolveArgValue(args[2], sheet));
      return { value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }

    case 'MIN': {
      let minVal: number | null = null;
      for (const arg of args) {
        const vals = arg.includes(':') ? getRangeValues(arg, sheet) : [resolveArgValue(arg, sheet)];
        for (const v of vals) {
          const num = Number(v);
          if (!isNaN(num) && v !== null && v !== '') {
            if (minVal === null || num < minVal) minVal = num;
          }
        }
      }
      return { value: minVal ?? 0 };
    }

    case 'MAX': {
      let maxVal: number | null = null;
      for (const arg of args) {
        const vals = arg.includes(':') ? getRangeValues(arg, sheet) : [resolveArgValue(arg, sheet)];
        for (const v of vals) {
          const num = Number(v);
          if (!isNaN(num) && v !== null && v !== '') {
            if (maxVal === null || num > maxVal) maxVal = num;
          }
        }
      }
      return { value: maxVal ?? 0 };
    }

    default:
      return { value: '#NAME?', error: `Unknown formula function: ${name}` };
  }
}
