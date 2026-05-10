import { describe, it, expect } from 'vitest';
import { containsCodeBlocks } from './codeBlocks';

describe('containsCodeBlocks', () => {
  it('flags 4-space indent', () => {
    expect(containsCodeBlocks('    code line')).toBe(true);
  });

  it('flags tab-prefixed', () => {
    expect(containsCodeBlocks('\tcode line')).toBe(true);
  });

  it('flags spaces+tab (3 spaces then tab)', () => {
    expect(containsCodeBlocks('   \tmaybe code')).toBe(true);
  });

  it('does not flag normal prose', () => {
    expect(containsCodeBlocks('A normal opening sentence.')).toBe(false);
  });

  it('skips whitespace-only paragraphs', () => {
    expect(containsCodeBlocks('   \n\nA normal sentence.')).toBe(false);
  });

  it('handles empty body', () => {
    expect(containsCodeBlocks('')).toBe(false);
  });
});
