import { PartyRule, AutomationRule, SheetData, SheetRow } from '../types';

export interface InstructionLookupResult {
  found: boolean;
  instruction: string;
  ruleMatched?: PartyRule;
  matchType?: 'exact' | 'case_insensitive' | 'alias' | 'none';
  conditionMatched?: string;
  hasMultipleRules?: boolean;
  alternativeRules?: PartyRule[];
}

/**
 * Normalizes party strings for comparison (trims and converts to uppercase)
 */
export function normalizePartyName(name: string): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,\/#!$%\^*;:{}=\-_`~()]/g, '')
    .replace(/\bAND\b/g, '&')
    .replace(/\bLIMITED\b/g, 'LTD')
    .replace(/\bPRIVATE\b/g, 'PVT')
    .trim();
}

/**
 * Searches Control Center party rules for a given party name,
 * evaluating seller condition, aliases, and priority.
 */
export function lookupPartyInstruction(
  partyName: string,
  sellerName: string = '',
  rules: PartyRule[]
): InstructionLookupResult {
  const rawParty = String(partyName || '').trim();
  const cleanParty = normalizePartyName(partyName);
  const cleanSeller = normalizePartyName(sellerName);

  if (!rawParty || !cleanParty) {
    return {
      found: false,
      instruction: '',
      matchType: 'none',
    };
  }

  // Filter only enabled rules
  const activeRules = rules.filter((r) => r.enabled);

  // 1. Find all rules that match the party name (directly, normalized, aliases, or root match)
  const matchingRules: { rule: PartyRule; matchType: 'exact' | 'case_insensitive' | 'alias' }[] = [];

  for (const rule of activeRules) {
    const ruleParty = normalizePartyName(rule.partyName);
    const exactRaw = rule.partyName.trim().toUpperCase() === rawParty.toUpperCase();
    const normMatch = ruleParty === cleanParty;
    const aliasMatch = rule.aliases && rule.aliases.some((alias) => normalizePartyName(alias) === cleanParty);
    const rootMatch =
      cleanParty.length >= 4 &&
      ruleParty.length >= 4 &&
      (cleanParty.startsWith(ruleParty) || ruleParty.startsWith(cleanParty) || cleanParty.includes(ruleParty) || ruleParty.includes(cleanParty));

    if (exactRaw) {
      matchingRules.push({ rule, matchType: 'exact' });
    } else if (normMatch) {
      matchingRules.push({ rule, matchType: 'case_insensitive' });
    } else if (aliasMatch) {
      matchingRules.push({ rule, matchType: 'alias' });
    } else if (rootMatch) {
      matchingRules.push({ rule, matchType: 'alias' });
    }
  }

  if (matchingRules.length === 0) {
    return {
      found: false,
      instruction: '',
      matchType: 'none',
    };
  }

  // Sort matched rules by priority ascending (1 is higher priority than 10)
  const sorted = matchingRules.sort((a, b) => (a.rule.priority || 99) - (b.rule.priority || 99));

  // 2. Try to find a rule with matching sellerCondition if sellerName is provided
  if (cleanSeller) {
    const sellerMatch = sorted.find((item) => {
      const cond = normalizePartyName(item.rule.sellerCondition || '');
      return cond && (cond === cleanSeller || cleanSeller.startsWith(cond) || cond.startsWith(cleanSeller));
    });

    if (sellerMatch) {
      return {
        found: true,
        instruction: sellerMatch.rule.instruction,
        ruleMatched: sellerMatch.rule,
        matchType: sellerMatch.matchType,
        conditionMatched: `Seller = ${sellerMatch.rule.sellerCondition}`,
        hasMultipleRules: sorted.length > 1,
        alternativeRules: sorted.filter((s) => s.rule.id !== sellerMatch.rule.id).map((s) => s.rule),
      };
    }
  }

  // 3. Fallback to default rule (rule with empty or wildcard seller condition)
  const defaultRule = sorted.find((item) => !normalizePartyName(item.rule.sellerCondition || ''));
  if (defaultRule) {
    return {
      found: true,
      instruction: defaultRule.rule.instruction,
      ruleMatched: defaultRule.rule,
      matchType: defaultRule.matchType,
      conditionMatched: 'Default (Any Seller)',
      hasMultipleRules: sorted.length > 1,
      alternativeRules: sorted.filter((s) => s.rule.id !== defaultRule.rule.id).map((s) => s.rule),
    };
  }

  // 4. If no specific seller match and no default rule, pick the highest priority rule
  const topRule = sorted[0];
  return {
    found: true,
    instruction: topRule.rule.instruction,
    ruleMatched: topRule.rule,
    matchType: topRule.matchType,
    conditionMatched: topRule.rule.sellerCondition ? `Seller = ${topRule.rule.sellerCondition}` : 'Default',
    hasMultipleRules: sorted.length > 1,
    alternativeRules: sorted.slice(1).map((s) => s.rule),
  };
}

/**
 * Fuzzy suggestions for party names (never automatically applied, only suggested to user)
 */
export function getFuzzyPartySuggestions(input: string, rules: PartyRule[], maxSuggestions = 5): string[] {
  const cleanInput = normalizePartyName(input);
  if (!cleanInput || cleanInput.length < 2) return [];

  const uniqueParties = Array.from(new Set(rules.map((r) => r.partyName)));
  const matches: { name: string; score: number }[] = [];

  for (const party of uniqueParties) {
    const cleanParty = normalizePartyName(party);
    if (cleanParty === cleanInput) continue; // exact match handled already

    if (cleanParty.includes(cleanInput) || cleanInput.includes(cleanParty)) {
      matches.push({ name: party, score: 0.8 });
    } else {
      // Simple character overlap score
      const setA = new Set(cleanInput.split(''));
      const setB = new Set(cleanParty.split(''));
      let overlap = 0;
      setA.forEach((c) => {
        if (setB.has(c)) overlap++;
      });
      const score = overlap / Math.max(setA.size, setB.size);
      if (score >= 0.6) {
        matches.push({ name: party, score });
      }
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map((m) => m.name);
}

/**
 * Evaluates automation rules on cell change
 */
export function processAutomations(
  trigger: 'on_cell_edit' | 'on_party_entered' | 'on_row_added' | 'on_status_changed' | 'on_duplicate',
  sheet: SheetData,
  rowIndex: number,
  columnId: string,
  automations: AutomationRule[],
  partyRules: PartyRule[]
): { updatedRow: SheetRow; actionsTaken: string[] } {
  let row = { ...(sheet.rows[rowIndex] || {}) };
  const actionsTaken: string[] = [];

  // Find column name
  const colDef = sheet.columns.find((c) => c.id === columnId);
  const colName = (colDef?.name || '').trim().toUpperCase();

  // Find party & seller & instructions columns (flexible matching across all header conventions)
  const partyCol = sheet.columns.find((c) => {
    const n = c.name.trim().toUpperCase();
    return n === 'PARTY' || n === 'PARTY NAME' || n.includes('PARTY');
  });
  const sellerCol = sheet.columns.find((c) => {
    const n = c.name.trim().toUpperCase();
    return n === 'SELLER' || n === 'SELLER NAME' || n.includes('SELLER');
  });
  const instCol = sheet.columns.find((c) => {
    const n = c.name.trim().toUpperCase();
    return n === 'INSTRUCTIONS' || n === 'INSTRUCTION' || n.includes('INSTRUCTION');
  });
  const remarkCol = sheet.columns.find((c) => {
    const n = c.name.trim().toUpperCase();
    return n === 'REMARK' || n === 'REMARKS' || n.includes('REMARK') || n.includes('STATUS');
  });

  const partyVal = partyCol ? String(row[partyCol.id]?.value || '').trim() : '';
  const sellerVal = sellerCol ? String(row[sellerCol.id]?.value || '').trim() : '';

  const isPartyCol = partyCol && partyCol.id === columnId;
  const isSellerCol = sellerCol && sellerCol.id === columnId;

  // Core instruction lookup automation whenever PARTY or SELLER changes
  if ((isPartyCol || isSellerCol || colName.includes('PARTY') || colName.includes('SELLER')) && instCol) {
    if (!partyVal) {
      // cleared party -> clear instruction
      if (row[instCol.id]?.value) {
        row = {
          ...row,
          [instCol.id]: {
            ...row[instCol.id],
            value: '',
          },
        };
        actionsTaken.push('Cleared instruction because party name was emptied');
      }
    } else {
      const lookup = lookupPartyInstruction(partyVal, sellerVal, partyRules);
      if (lookup.found) {
        const prevInst = row[instCol.id]?.value;
        if (prevInst !== lookup.instruction) {
          row = {
            ...row,
            [instCol.id]: {
              ...row[instCol.id],
              value: lookup.instruction,
            },
          };
          actionsTaken.push(`Auto-populated instruction "${lookup.instruction}" for "${partyVal}" (${lookup.conditionMatched || 'rule'})`);
        }
      } else {
        // Clear indication when no rule matches
        const prevInst = row[instCol.id]?.value;
        const noInstText = 'Not Configured';
        if (prevInst !== noInstText) {
          row = {
            ...row,
            [instCol.id]: {
              ...row[instCol.id],
              value: noInstText,
            },
          };
          actionsTaken.push(`No instruction rule configured for party "${partyVal}"`);
        }
      }
    }
  }

  // Evaluate custom user automations
  for (const auto of automations.filter((a) => a.enabled)) {
    if (auto.targetSheetId && auto.targetSheetId !== 'all' && auto.targetSheetId !== sheet.id) {
      continue;
    }

    // Check conditions
    let conditionsMet = true;
    for (const cond of auto.conditions) {
      const targetColDef = sheet.columns.find((c) => c.name.toUpperCase() === cond.field.toUpperCase());
      const cellVal = targetColDef ? String(row[targetColDef.id]?.value ?? '').trim() : '';

      switch (cond.operator) {
        case 'equals':
          if (cellVal.toLowerCase() !== cond.value.toLowerCase()) conditionsMet = false;
          break;
        case 'contains':
          if (!cellVal.toLowerCase().includes(cond.value.toLowerCase())) conditionsMet = false;
          break;
        case 'starts_with':
          if (!cellVal.toLowerCase().startsWith(cond.value.toLowerCase())) conditionsMet = false;
          break;
        case 'not_empty':
          if (cellVal === '') conditionsMet = false;
          break;
        default:
          break;
      }
      if (!conditionsMet) break;
    }

    if (conditionsMet) {
      if (auto.action.type === 'set_cell' && auto.action.targetColumn) {
        row = {
          ...row,
          [auto.action.targetColumn]: {
            ...row[auto.action.targetColumn],
            value: auto.action.value ?? '',
          },
        };
        actionsTaken.push(`Automation [${auto.name}] updated column ${auto.action.targetColumn}`);
      } else if (auto.action.type === 'set_instruction' && instCol) {
        const lookup = lookupPartyInstruction(partyVal, sellerVal, partyRules);
        if (lookup.found) {
          row = {
            ...row,
            [instCol.id]: {
              ...row[instCol.id],
              value: lookup.instruction,
            },
          };
          actionsTaken.push(`Automation [${auto.name}] set instruction to "${lookup.instruction}"`);
        }
      } else if (auto.action.type === 'set_status' && remarkCol) {
        row = {
          ...row,
          [remarkCol.id]: {
            ...row[remarkCol.id],
            value: auto.action.value ?? '',
          },
        };
        actionsTaken.push(`Automation [${auto.name}] set status to "${auto.action.value}"`);
      }
    }
  }

  return { updatedRow: row, actionsTaken };
}
