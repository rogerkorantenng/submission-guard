import { describe, it, expect } from 'vitest';
import { findLongParagraphs } from './longParagraphs';

describe('findLongParagraphs', () => {
  it('flags a paragraph over 350 words', () => {
    const big = 'word '.repeat(351).trim();
    const r = findLongParagraphs(big);
    expect(r.offending).toEqual([{ index: 0, wordCount: 351 }]);
  });

  it('does not flag at exactly 350', () => {
    const exact = 'word '.repeat(350).trim();
    expect(findLongParagraphs(exact).offending).toEqual([]);
  });

  it('counts \\w+ only (`&` and `--` ignored)', () => {
    const body = 'a & b -- c d';
    expect(findLongParagraphs(body, 5).offending).toEqual([]);
  });

  it('respects a custom max', () => {
    const body = 'word '.repeat(11).trim();
    expect(findLongParagraphs(body, 10).offending).toEqual([{ index: 0, wordCount: 11 }]);
  });

  it('splits on blank lines', () => {
    const body = `${'word '.repeat(351).trim()}\n\nfine paragraph`;
    expect(findLongParagraphs(body).offending).toEqual([{ index: 0, wordCount: 351 }]);
  });
});
