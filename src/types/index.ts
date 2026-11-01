export type CellValue = string | number | null;

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  bg?: string;
  color?: string;
  borderColor?: string;
}

export interface CellData {
  value: CellValue;
  formula?: string;
  style?: CellStyle;
  format?: string;
}

export interface ColumnDef {
  id: string; // e.g. 'col_0', 'col_1'
  name: string; // Header title e.g. 'SR NUM', 'PARTY'
  width: number;
  type?: 'text' | 'number' | 'date' | 'select' | 'formula';
  options?: string[]; // for dropdown
  formula?: string;
  hidden?: boolean;
}

export interface SheetRow {
  [columnId: string]: CellData;
}

export interface SheetData {
  id: string;
  name: string;
  columns: ColumnDef[];
  rows: SheetRow[];
  color?: string;
  hidden?: boolean;
  isFrozenHeader?: boolean;
  rowHeights?: Record<number, number>;
}

export interface PartyRule {
  id: string;
  partyName: string;
  sellerCondition?: string; // Optional: If specified, this rule matches only when seller matches
  instruction: string;
  priority: number;
  enabled: boolean;
  aliases?: string[];
  notes?: string;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'on_cell_edit' | 'on_party_entered' | 'on_row_added' | 'on_status_changed' | 'on_duplicate';
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'not_empty' | 'is_duplicate';
    value: string;
  }[];
  action: {
    type: 'set_cell' | 'set_status' | 'set_instruction' | 'speak_alert' | 'highlight_row';
    targetColumn?: string;
    value?: string;
    color?: string;
  };
  targetSheetId?: string; // or 'all'
  priority: number;
  enabled: boolean;
  description?: string;
}

export interface ConditionalFormatRule {
  id: string;
  name: string;
  sheetId: string; // 'all' or specific sheet id
  columnId: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'is_empty' | 'is_duplicate';
  value: string;
  bg: string;
  color: string;
  enabled: boolean;
  priority: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  sheetName: string;
  cellCoord: string;
  oldValue: string;
  newValue: string;
  source: 'user' | 'automation' | 'lookup' | 'import' | 'system';
  description: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  showGridLines: boolean;
  autoSaveIntervalSec: number;
  defaultZoom: number;
  ttsVoice: string;
  soundEffects: boolean;
}

export interface WorkbookState {
  version: number;
  sheets: SheetData[];
  activeSheetId: string;
  controlCenterRules: PartyRule[];
  automations: AutomationRule[];
  conditionalFormats: ConditionalFormatRule[];
  auditLogs: AuditLogEntry[];
  settings: AppSettings;
}

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}
