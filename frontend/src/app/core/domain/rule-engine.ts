import { RuleDecision, RuleNode, RuleTree } from '../models';

/**
 * Evaluator for the legacy decision-tree rule files (NOC-base/uploads/rules/*.rule),
 * which the ASP.NET backend interpreted server-side (calculateffe.aspx, floorwise_ffe.aspx,
 * validations/*.rule). The trees are served verbatim as JSON assets.
 *
 * Format: `{ "start": "<node>", "<node>": { "check": "@var", "dtype": "n"|"s", "decisions": [...] } }`
 * Each decision is `{ oper, check, check2?, action: "goto"|"return", value }`, evaluated in order;
 * the first match wins.
 *
 * Operator semantics (derived from how they are combined in the rule files):
 *   DEF  always matches (default branch)
 *   EQ   numeric equality for numbers, case-insensitive equality for strings ("MLCP" vs sub-type "mlcp")
 *   GT / GE / LT / LE   numeric comparisons
 *   BR   check <  v <= check2   (e.g. "LE 10" → "BR 10..15" → "BR 15..30")
 *   BL   check <= v <  check2   (e.g. "LT 10" → "BL 10..18" → "GE 18")
 * A `goto` to a node that does not exist (e.g. "c2c3" in 1.rule) yields "" (= not required),
 * which is what the legacy engine returned.
 */
export type RuleVars = Record<string, string | number | boolean | null | undefined>;

export interface RuleResult {
  value: string;
  /** Node names visited, for traceability ("why is this required?"). */
  path: string[];
}

const MAX_STEPS = 200;

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') {
    return typeof v === 'boolean' ? (v ? 1 : 0) : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function decisionMatches(d: RuleDecision, raw: unknown): boolean {
  if (d.oper === 'DEF') return true;
  if (d.oper === 'EQ') {
    const a = toNumber(raw);
    const b = toNumber(d.check);
    if (a !== null && b !== null) return a === b;
    return String(raw ?? '').trim().toLowerCase() === String(d.check ?? '').trim().toLowerCase();
  }
  const v = toNumber(raw);
  const c = toNumber(d.check);
  if (v === null || c === null) return false;
  switch (d.oper) {
    case 'GT':
      return v > c;
    case 'GE':
      return v >= c;
    case 'LT':
      return v < c;
    case 'LE':
      return v <= c;
    case 'BR': {
      const c2 = toNumber(d.check2);
      return c2 !== null && v > c && v <= c2;
    }
    case 'BL': {
      const c2 = toNumber(d.check2);
      return c2 !== null && v >= c && v < c2;
    }
    default:
      return false;
  }
}

function variableName(check: string): string {
  return check.startsWith('@') ? check.slice(1) : check;
}

export function evaluateRule(tree: RuleTree, vars: RuleVars): RuleResult {
  const path: string[] = [];
  let nodeName = tree.start;
  for (let step = 0; step < MAX_STEPS; step++) {
    const node = tree[nodeName] as RuleNode | undefined;
    if (!node || typeof node === 'string') {
      return { value: '', path };
    }
    path.push(nodeName);
    const raw = vars[variableName(node.check)];
    const decision = node.decisions.find((d) => decisionMatches(d, raw));
    if (!decision) {
      return { value: '', path };
    }
    if (decision.action === 'return') {
      return { value: decision.value ?? '', path };
    }
    nodeName = decision.value;
  }
  throw new Error(`Rule evaluation exceeded ${MAX_STEPS} steps (cycle at "${nodeName}")`);
}
