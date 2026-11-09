import { generateTemporaryPassword, passwordProblem } from './password';

describe('password helpers', () => {
  it('generates a password of the requested length without ambiguous characters', () => {
    const p = generateTemporaryPassword(40);
    expect(p).toHaveLength(40);
    expect(p).not.toMatch(/[O0Il1]/);
  });

  it('validates new passwords', () => {
    expect(passwordProblem('abc', 'abc')).toContain('at least');
    expect(passwordProblem('abcdef', 'abcdeg')).toContain('do not match');
    expect(passwordProblem('abcdef', 'abcdef')).toBeNull();
  });
});
