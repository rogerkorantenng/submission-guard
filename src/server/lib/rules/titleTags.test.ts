import { describe, it, expect } from 'vitest';
import { analyzeTitleTags } from './titleTags';

describe('analyzeTitleTags - parity with nosleepautobot tests', () => {
  it('accepts a single bracketed integer', () => {
    expect(analyzeTitleTags('My story [3]').invalidTags).toEqual([]);
  });

  it('accepts text-number tags through nineteen', () => {
    for (const n of ['one', 'TWO', 'three', 'fifteen', 'NINETEEN']) {
      expect(analyzeTitleTags(`X [${n}]`).invalidTags, n).toEqual([]);
    }
  });

  it('rejects unrecognized text numbers like "oneteen"', () => {
    expect(analyzeTitleTags('X [oneteen]').invalidTags).toEqual(['[oneteen]']);
  });

  it('accepts part/pt tags with text or numeric', () => {
    expect(analyzeTitleTags('X [Part 4]').isSeries).toBe(true);
    expect(analyzeTitleTags('X [pt. 5]').isSeries).toBe(true);
    expect(analyzeTitleTags('X (Part Two)').isSeries).toBe(true);
  });

  it('accepts vol / volume', () => {
    expect(analyzeTitleTags('X [Vol 2]').isSeries).toBe(true);
    expect(analyzeTitleTags('X [Volume 12]').isSeries).toBe(true);
    expect(analyzeTitleTags('X [vol. 3]').isSeries).toBe(true);
  });

  it('accepts update tag variants', () => {
    expect(analyzeTitleTags('X [update]').isSeries).toBe(true);
    expect(analyzeTitleTags('X [Update #3]').isSeries).toBe(true);
    expect(analyzeTitleTags('X [Update 4]').isSeries).toBe(true);
  });

  it('rejects update with no space', () => {
    expect(analyzeTitleTags('X [Update3]').invalidTags).toEqual(['[Update3]']);
    expect(analyzeTitleTags('X [Update#3]').invalidTags).toEqual(['[Update#3]']);
  });

  it('rejects "Part 1 of 2" style', () => {
    expect(analyzeTitleTags('X [Part 1 of 2]').invalidTags).toEqual(['[Part 1 of 2]']);
  });

  it('detects finale and sets isFinal', () => {
    const r = analyzeTitleTags('X [Finale]');
    expect(r.isSeries).toBe(true);
    expect(r.isFinal).toBe(true);
  });

  it('detects "final" too (no e)', () => {
    const r = analyzeTitleTags('X [Final]');
    expect(r.isFinal).toBe(true);
  });

  it('honors a custom regex pattern from settings', () => {
    const r = analyzeTitleTags('X [HORROR-OC]', { customPatterns: ['^horror-oc$'] });
    expect(r.invalidTags).toEqual([]);
  });

  it('safely ignores a malformed custom regex', () => {
    const r = analyzeTitleTags('X [HORROR]', { customPatterns: ['['] });
    expect(r.invalidTags).toEqual(['[HORROR]']);
  });
});
