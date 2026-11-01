import { WorkbookState, SheetData, PartyRule, AutomationRule, ConditionalFormatRule, AppSettings } from '../types';

export const INITIAL_SETTINGS: AppSettings = {
  theme: 'dark',
  showGridLines: true,
  autoSaveIntervalSec: 5,
  defaultZoom: 100,
  ttsVoice: 'Kore',
  soundEffects: true,
};

export const INITIAL_PARTY_RULES: PartyRule[] = [
  {
    id: 'pr_1',
    partyName: 'RATNA JEWELS',
    sellerCondition: 'AKSHAT',
    instruction: 'R3181',
    priority: 1,
    enabled: true,
    aliases: ['RATNA', 'RATNA JEWELLERS', 'RATNA J.'],
    notes: 'Priority rule for seller Akshat (Direct diamond consignment)',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_2',
    partyName: 'RATNA JEWELS',
    sellerCondition: 'RUSHIKESH',
    instruction: 'R3182',
    priority: 2,
    enabled: true,
    aliases: ['RATNA', 'RATNA JEWELLERS'],
    notes: 'Rule for seller Rushikesh (Requires Surat dispatch mark)',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_3',
    partyName: 'RATNA JEWELS',
    sellerCondition: '',
    instruction: 'R3180',
    priority: 10,
    enabled: true,
    aliases: ['RATNA'],
    notes: 'Default instruction when no seller condition matches',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_4',
    partyName: 'MOTI TRADERS',
    sellerCondition: '',
    instruction: 'M4021',
    priority: 5,
    enabled: true,
    aliases: ['MOTI', 'MOTI TRD'],
    notes: 'Standard billing instruction',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_5',
    partyName: 'SHREE GANESH JEWELLERS',
    sellerCondition: '',
    instruction: 'SG990',
    priority: 5,
    enabled: true,
    aliases: ['GANESH JEWELLERS', 'SG JEWELS'],
    notes: 'Hold until GST verification confirmed',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_6',
    partyName: 'KOTHARI & SONS',
    sellerCondition: '',
    instruction: 'KS551',
    priority: 5,
    enabled: true,
    aliases: ['KOTHARI SONS', 'KOTHARI'],
    notes: 'Courier with insured seal',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_7',
    partyName: 'RAJPUTANA GEMS',
    sellerCondition: '',
    instruction: 'RG108',
    priority: 5,
    enabled: true,
    aliases: ['RAJPUTANA'],
    notes: 'Air freight expedited delivery',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_8',
    partyName: 'DIAMOND HOUSE',
    sellerCondition: '',
    instruction: 'DH404',
    priority: 5,
    enabled: true,
    aliases: ['DH', 'DIAMOND HOUSE MUMBAI'],
    notes: 'Direct delivery to vault representative',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_9',
    partyName: 'ZAVERI BROTHERS',
    sellerCondition: '',
    instruction: 'ZB701',
    priority: 5,
    enabled: true,
    aliases: ['ZAVERI BROS', 'ZAVERI'],
    notes: 'Standard 14-day payment cycle',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_10',
    partyName: 'AMBICA ORNAMENTS',
    sellerCondition: '',
    instruction: 'AO233',
    priority: 5,
    enabled: true,
    aliases: ['AMBICA'],
    notes: 'Tax invoice triplicate needed',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_11',
    partyName: 'SURAT DIAMOND MART',
    sellerCondition: '',
    instruction: 'SD818',
    priority: 5,
    enabled: true,
    aliases: ['SDM', 'SURAT DIAMOND'],
    notes: 'E-way bill print mandatory',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_12',
    partyName: 'JAIN JEWELLERS',
    sellerCondition: '',
    instruction: 'JJ992',
    priority: 5,
    enabled: true,
    aliases: ['JAIN JEWELS'],
    notes: 'Attach lab certificate copies',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_13',
    partyName: 'TARA ENTERPRISES',
    sellerCondition: '',
    instruction: 'TE605',
    priority: 5,
    enabled: true,
    aliases: ['TARA'],
    notes: 'Hand over to authorized courier only',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_14',
    partyName: 'ROYAL GEMS',
    sellerCondition: '',
    instruction: 'RG330',
    priority: 5,
    enabled: true,
    aliases: ['ROYAL'],
    notes: 'VIP customer packaging requested',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_15',
    partyName: 'RELIABLE JEWELS',
    sellerCondition: '',
    instruction: 'RJ101',
    priority: 5,
    enabled: true,
    aliases: ['RELIABLE'],
    notes: 'Dispatched via secure route',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_16',
    partyName: 'LAXMI CREATIONS',
    sellerCondition: '',
    instruction: 'LC889',
    priority: 5,
    enabled: true,
    aliases: ['LAXMI'],
    notes: 'Confirm receiving before next batch',
    updatedAt: '2026-10-31T10:00:00Z',
  },
  {
    id: 'pr_17',
    partyName: 'GOLDEN ART JEWELLERY',
    sellerCondition: '',
    instruction: 'GA402',
    priority: 5,
    enabled: true,
    aliases: ['GOLDEN ART', 'GA JEWELLERY'],
    notes: 'Standard dispatch with tracking',
    updatedAt: '2026-10-31T10:00:00Z',
  },
];

export const INITIAL_CONDITIONAL_FORMATS: ConditionalFormatRule[] = [
  {
    id: 'cf_1',
    name: 'Pending Status',
    sheetId: 'all',
    columnId: 'col_5', // REMARK
    operator: 'equals',
    value: 'PENDING',
    bg: '#FEF3C7',
    color: '#92400E',
    enabled: true,
    priority: 1,
  },
  {
    id: 'cf_2',
    name: 'Print Status',
    sheetId: 'all',
    columnId: 'col_5',
    operator: 'equals',
    value: 'PRINT',
    bg: '#DBEAFE',
    color: '#1E40AF',
    enabled: true,
    priority: 2,
  },
  {
    id: 'cf_3',
    name: 'Backdated Status',
    sheetId: 'all',
    columnId: 'col_5',
    operator: 'equals',
    value: 'BACKDATED',
    bg: '#EDE9FE',
    color: '#5B21B6',
    enabled: true,
    priority: 3,
  },
  {
    id: 'cf_4',
    name: 'Uploaded Status',
    sheetId: 'all',
    columnId: 'col_5',
    operator: 'equals',
    value: 'UPLOADED',
    bg: '#D1FAE5',
    color: '#065F46',
    enabled: true,
    priority: 4,
  },
  {
    id: 'cf_5',
    name: 'Cancellation Status',
    sheetId: 'all',
    columnId: 'col_5',
    operator: 'equals',
    value: 'CANCELLATION',
    bg: '#FEE2E2',
    color: '#991B1B',
    enabled: true,
    priority: 5,
  },
  {
    id: 'cf_dup_inv',
    name: 'Duplicate Invoice Number',
    sheetId: 'all',
    columnId: 'col_2', // INV NUM
    operator: 'is_duplicate',
    value: '',
    bg: '#FFE4E6',
    color: '#BE123C',
    enabled: true,
    priority: 6,
  },
  {
    id: 'cf_empty_party',
    name: 'Missing Party Name',
    sheetId: 'all',
    columnId: 'col_3', // PARTY
    operator: 'is_empty',
    value: '',
    bg: '#FFFBEB',
    color: '#B45309',
    enabled: true,
    priority: 7,
  },
  {
    id: 'cf_empty_instruction',
    name: 'Missing Instruction',
    sheetId: 'all',
    columnId: 'col_6', // INSTRUCTIONS
    operator: 'is_empty',
    value: '',
    bg: '#FFF7ED',
    color: '#C2410C',
    enabled: true,
    priority: 8,
  },
];

export const INITIAL_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto_1',
    name: 'Auto-Retrieve Party Instruction',
    trigger: 'on_party_entered',
    conditions: [
      {
        field: 'PARTY',
        operator: 'not_empty',
        value: '',
      },
    ],
    action: {
      type: 'set_instruction',
      targetColumn: 'col_6',
    },
    targetSheetId: 'all',
    priority: 1,
    enabled: true,
    description: 'When party name is typed, searches Control Center (factoring Seller) and sets INSTRUCTIONS column',
  },
  {
    id: 'auto_2',
    name: 'Auto-Clear Instruction on Party Clear',
    trigger: 'on_cell_edit',
    conditions: [
      {
        field: 'PARTY',
        operator: 'equals',
        value: '',
      },
    ],
    action: {
      type: 'set_cell',
      targetColumn: 'col_6',
      value: '',
    },
    targetSheetId: 'all',
    priority: 2,
    enabled: true,
    description: 'Clears the instruction if party name is erased',
  },
  {
    id: 'auto_3',
    name: 'Cancellation Alert & Highlight',
    trigger: 'on_status_changed',
    conditions: [
      {
        field: 'REMARK',
        operator: 'equals',
        value: 'CANCELLATION',
      },
    ],
    action: {
      type: 'highlight_row',
      color: '#FEE2E2',
    },
    targetSheetId: 'all',
    priority: 3,
    enabled: true,
    description: 'Highlights row when marked as CANCELLATION',
  },
];

export function getInitialWorkbook(): WorkbookState {
  // Sheet 1: 31.10.2026 — Invoice Register
  const invoiceColumns = [
    { id: 'col_0', name: 'SR NUM', width: 80, type: 'number' as const },
    { id: 'col_1', name: 'TRN NUM', width: 130, type: 'text' as const },
    { id: 'col_2', name: 'INV NUM', width: 130, type: 'text' as const },
    { id: 'col_3', name: 'PARTY', width: 250, type: 'text' as const },
    { id: 'col_4', name: 'SELLER', width: 160, type: 'text' as const },
    {
      id: 'col_5',
      name: 'REMARK',
      width: 170,
      type: 'select' as const,
      options: ['PENDING', 'PRINT', 'BACKDATED', 'UPLOADED', 'CANCELLATION'],
    },
    { id: 'col_6', name: 'INSTRUCTIONS', width: 260, type: 'text' as const },
  ];

  const rawInvoiceData = [
    { sr: 1, trn: 'TRN-9021', inv: 'INV-1042', party: 'RATNA JEWELS', seller: 'AKSHAT', remark: 'PRINT', inst: 'R3181' },
    { sr: 2, trn: 'TRN-9022', inv: 'INV-1043', party: 'MOTI TRADERS', seller: 'RUSHIKESH', remark: 'UPLOADED', inst: 'M4021' },
    { sr: 3, trn: 'TRN-9023', inv: 'INV-1044', party: 'RATNA JEWELS', seller: 'RUSHIKESH', remark: 'PENDING', inst: 'R3182' },
    { sr: 4, trn: 'TRN-9024', inv: 'INV-1045', party: 'SHREE GANESH JEWELLERS', seller: 'NIKHIL', remark: 'PRINT', inst: 'SG990' },
    { sr: 5, trn: 'TRN-9025', inv: 'INV-1046', party: 'KOTHARI & SONS', seller: 'AKSHAT', remark: 'BACKDATED', inst: 'KS551' },
    { sr: 6, trn: 'TRN-9026', inv: 'INV-1047', party: 'RAJPUTANA GEMS', seller: 'SURESH', remark: 'UPLOADED', inst: 'RG108' },
    { sr: 7, trn: 'TRN-9027', inv: 'INV-1048', party: 'DIAMOND HOUSE', seller: 'RUSHIKESH', remark: 'CANCELLATION', inst: 'DH404' },
    { sr: 8, trn: 'TRN-9028', inv: 'INV-1049', party: 'ZAVERI BROTHERS', seller: 'VIPUL', remark: 'PENDING', inst: 'ZB701' },
    { sr: 9, trn: 'TRN-9029', inv: 'INV-1050', party: 'AMBICA ORNAMENTS', seller: 'AKSHAT', remark: 'PRINT', inst: 'AO233' },
    { sr: 10, trn: 'TRN-9030', inv: 'INV-1051', party: 'SURAT DIAMOND MART', seller: 'NIKHIL', remark: 'UPLOADED', inst: 'SD818' },
    { sr: 11, trn: 'TRN-9031', inv: 'INV-1052', party: 'JAIN JEWELLERS', seller: 'SURESH', remark: 'PENDING', inst: 'JJ992' },
    { sr: 12, trn: 'TRN-9032', inv: 'INV-1053', party: 'TARA ENTERPRISES', seller: 'AKSHAT', remark: 'PRINT', inst: 'TE605' },
    { sr: 13, trn: 'TRN-9033', inv: 'INV-1054', party: 'ROYAL GEMS', seller: 'VIPUL', remark: 'BACKDATED', inst: 'RG330' },
    { sr: 14, trn: 'TRN-9034', inv: 'INV-1055', party: 'RELIABLE JEWELS', seller: 'RUSHIKESH', remark: 'UPLOADED', inst: 'RJ101' },
    { sr: 15, trn: 'TRN-9035', inv: 'INV-1056', party: 'LAXMI CREATIONS', seller: 'AKSHAT', remark: 'PENDING', inst: 'LC889' },
    { sr: 16, trn: 'TRN-9036', inv: 'INV-1057', party: 'GOLDEN ART JEWELLERY', seller: 'NIKHIL', remark: 'PRINT', inst: 'GA402' },
  ];

  const invoiceRows: any[] = [];
  rawInvoiceData.forEach((item) => {
    invoiceRows.push({
      col_0: { value: item.sr },
      col_1: { value: item.trn },
      col_2: { value: item.inv },
      col_3: { value: item.party },
      col_4: { value: item.seller },
      col_5: { value: item.remark },
      col_6: { value: item.inst },
    });
  });

  // Provide initial blank rows up to 60 rows for comfortable spreadsheet editing
  for (let i = invoiceRows.length; i < 60; i++) {
    invoiceRows.push({
      col_0: { value: i + 1 },
      col_1: { value: '' },
      col_2: { value: '' },
      col_3: { value: '' },
      col_4: { value: '' },
      col_5: { value: '' },
      col_6: { value: '' },
    });
  }

  // Sheet 2: CONTROL CENTER
  const controlColumns = [
    { id: 'col_0', name: 'PARTY NAME', width: 280, type: 'text' as const },
    { id: 'col_1', name: 'INSTRUCTION', width: 260, type: 'text' as const },
    { id: 'col_2', name: 'SELLER CONDITION', width: 180, type: 'text' as const },
    { id: 'col_3', name: 'PRIORITY', width: 100, type: 'number' as const },
    { id: 'col_4', name: 'NOTES', width: 320, type: 'text' as const },
  ];

  const controlRows: any[] = INITIAL_PARTY_RULES.map((rule) => ({
    col_0: { value: rule.partyName },
    col_1: { value: rule.instruction },
    col_2: { value: rule.sellerCondition || '(Any Seller)' },
    col_3: { value: rule.priority },
    col_4: { value: rule.notes || '' },
  }));

  for (let i = controlRows.length; i < 50; i++) {
    controlRows.push({
      col_0: { value: '' },
      col_1: { value: '' },
      col_2: { value: '' },
      col_3: { value: '' },
      col_4: { value: '' },
    });
  }

  const sheet1: SheetData = {
    id: 'sheet_invoice_20261031',
    name: '31.10.2026',
    columns: invoiceColumns,
    rows: invoiceRows,
    color: '#0284c7',
    isFrozenHeader: true,
  };

  const sheet2: SheetData = {
    id: 'sheet_control_center',
    name: 'CONTROL CENTER',
    columns: controlColumns,
    rows: controlRows,
    color: '#10b981',
    isFrozenHeader: true,
  };

  return {
    version: 1,
    sheets: [sheet1, sheet2],
    activeSheetId: sheet1.id,
    controlCenterRules: INITIAL_PARTY_RULES,
    automations: INITIAL_AUTOMATIONS,
    conditionalFormats: INITIAL_CONDITIONAL_FORMATS,
    auditLogs: [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        sheetName: '31.10.2026',
        cellCoord: 'ALL',
        oldValue: '',
        newValue: 'Imported Project XL workbook',
        source: 'system',
        description: 'Initial workbook setup with 31.10.2026 register and Control Center rules',
      },
    ],
    settings: INITIAL_SETTINGS,
  };
}
