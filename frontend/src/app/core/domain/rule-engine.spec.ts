import { fixture } from '../../../testing/fixture-backend';
import { RuleDecision, RuleTree } from '../models';
import { decisionMatches, evaluateRule } from './rule-engine';

const d = (oper: string, check: string, check2?: string) => ({ oper, check, check2, action: 'return', value: 'x' }) as RuleDecision;

describe('rule engine (legacy uploads/rules/*.rule decision trees)', () => {
  it('implements the comparison operators', () => {
    expect(decisionMatches(d('DEF', ''), undefined)).toBe(true);
    expect(decisionMatches(d('EQ', '15'), 15)).toBe(true);
    expect(decisionMatches(d('EQ', '15'), '15.0')).toBe(true);
    expect(decisionMatches(d('EQ', 'MLCP'), 'mlcp')).toBe(true); // case-insensitive strings
    expect(decisionMatches(d('EQ', 'A4'), 'A3')).toBe(false);
    expect(decisionMatches(d('GT', '15'), 15)).toBe(false);
    expect(decisionMatches(d('GE', '15'), 15)).toBe(true);
    expect(decisionMatches(d('LT', '15'), 14.99)).toBe(true);
    expect(decisionMatches(d('LE', '15'), 15)).toBe(true);
    // BR: check < v <= check2 ; BL: check <= v < check2
    expect(decisionMatches(d('BR', '15', '30'), 15)).toBe(false);
    expect(decisionMatches(d('BR', '15', '30'), 30)).toBe(true);
    expect(decisionMatches(d('BL', '10', '18'), 10)).toBe(true);
    expect(decisionMatches(d('BL', '10', '18'), 18)).toBe(false);
    // numeric comparisons never match non-numeric values (8.rule "mer" node compares a sub-type with LE 15)
    expect(decisionMatches(d('LE', '15'), 'F2')).toBe(false);
  });

  it('walks goto chains and returns the first matching decision', () => {
    const tree = {
      start: 'a',
      a: { check: '@h', dtype: 'n', decisions: [{ oper: 'GT', check: '10', action: 'goto', value: 'b' }, { oper: 'DEF', check: '', action: 'return', value: 'low' }] },
      b: { check: '@t', dtype: 's', decisions: [{ oper: 'EQ', check: 'res', action: 'return', value: 'high-res' }, { oper: 'DEF', check: '', action: 'return', value: 'high' }] },
    } as unknown as RuleTree;
    expect(evaluateRule(tree, { h: 5 }).value).toBe('low');
    expect(evaluateRule(tree, { h: 20, t: 'RES' })).toEqual({ value: 'high-res', path: ['a', 'b'] });
    expect(evaluateRule(tree, { h: 20, t: 'biz' }).value).toBe('high');
  });

  it('treats a goto to a missing node as "not required" (legacy behaviour)', () => {
    const tree = { start: 'a', a: { check: '@x', dtype: 's', decisions: [{ oper: 'DEF', check: '', action: 'goto', value: 'c2c3' }] } } as unknown as RuleTree;
    expect(evaluateRule(tree, {}).value).toBe('');
  });

  it('evaluates the verbatim height rule (validations/height.rule)', () => {
    const tree = fixture<RuleTree>('assets/data/rules/height-limits.json');
    const ok = (site_type: string, height: number) => evaluateRule(tree, { site_type, height }).value === 'valid';
    expect(ok('edu', 30)).toBe(true);
    expect(ok('edu', 30.5)).toBe(false);
    expect(ok('ind', 18)).toBe(true);
    expect(ok('ind', 19)).toBe(false);
    expect(ok('sto', 45)).toBe(true);
    expect(ok('haz', 16)).toBe(false);
  });

  it('loads all 12 equipment rule trees with a start node', () => {
    for (let id = 1; id <= 12; id++) {
      const tree = fixture<RuleTree>(`assets/data/rules/ffe/${id}.json`);
      expect(tree.start, `rule ${id}`).toBeTruthy();
      expect(tree[tree.start as string], `rule ${id} start node`).toBeTruthy();
    }
  });
});
