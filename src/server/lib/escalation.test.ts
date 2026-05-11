import { describe, it, expect } from 'vitest';
import { decideEscalation, decideRaidAlert } from './escalation';

describe('decideEscalation', () => {
  const config = { warnThreshold: 1, removeThreshold: 2 };

  it('first violation (priorCount=0) is a warn', () => {
    expect(decideEscalation(0, config)).toBe('warn');
  });

  it('second violation (priorCount=1) is a standard remove', () => {
    expect(decideEscalation(1, config)).toBe('remove');
  });

  it('third+ violation (priorCount=2) is remove-and-alert', () => {
    expect(decideEscalation(2, config)).toBe('remove-and-alert');
    expect(decideEscalation(5, config)).toBe('remove-and-alert');
  });

  it('with warnThreshold=0, every violation removes (skips warn tier)', () => {
    expect(decideEscalation(0, { warnThreshold: 0, removeThreshold: 1 })).toBe('remove');
  });
});

describe('decideRaidAlert', () => {
  it('alerts when distinct authors meets the floor', () => {
    expect(decideRaidAlert(5, { minDistinctAuthors: 5 }, 'invalid-tags')).toBe(true);
    expect(decideRaidAlert(10, { minDistinctAuthors: 5 }, 'rate-limit')).toBe(true);
  });

  it('does not alert below the floor', () => {
    expect(decideRaidAlert(4, { minDistinctAuthors: 5 }, 'invalid-tags')).toBe(false);
    expect(decideRaidAlert(1, { minDistinctAuthors: 5 }, 'invalid-tags')).toBe(false);
  });
});
