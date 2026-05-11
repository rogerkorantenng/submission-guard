import { describe, it, expect } from 'vitest';
import { englishifyTime, evaluateRateLimit, pickAgeTier } from './rateLimit';

const baseWindow = 86_400; // 24h
const now = 1_700_000_000_000;

describe('evaluateRateLimit -- baseline (no tiers)', () => {
  it('not rate-limited when no prior activity', () => {
    const r = evaluateRateLimit({
      prior: null,
      newPostId: 't3_x',
      newPostTimeMs: now,
      windowSec: baseWindow,
    });
    expect(r.rateLimited).toBe(false);
    expect(r.tierMultiplier).toBe(1);
    expect(r.effectiveWindowSec).toBe(baseWindow);
  });

  it('not rate-limited when re-processing same post', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 1000 };
    expect(
      evaluateRateLimit({ prior, newPostId: 't3_x', newPostTimeMs: now, windowSec: baseWindow })
        .rateLimited,
    ).toBe(false);
  });

  it('rate-limited within the window', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 3600_000 };
    const r = evaluateRateLimit({
      prior,
      newPostId: 't3_y',
      newPostTimeMs: now,
      windowSec: baseWindow,
    });
    expect(r.rateLimited).toBe(true);
    expect(r.waitSeconds).toBe(baseWindow - 3600);
  });

  it('not rate-limited past the window', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - (baseWindow + 60) * 1000 };
    expect(
      evaluateRateLimit({ prior, newPostId: 't3_y', newPostTimeMs: now, windowSec: baseWindow })
        .rateLimited,
    ).toBe(false);
  });
});

describe('pickAgeTier', () => {
  const tiers = [
    { maxAgeDays: 7, windowMultiplier: 2 },
    { maxAgeDays: 30, windowMultiplier: 1 },
    { maxAgeDays: Number.MAX_SAFE_INTEGER, windowMultiplier: 0.5 },
  ];

  it('picks 2x for brand-new account (3 days old)', () => {
    expect(pickAgeTier(tiers, 3)).toBe(2);
  });

  it('picks 1x for a 20-day-old account', () => {
    expect(pickAgeTier(tiers, 20)).toBe(1);
  });

  it('picks 0.5x for a tenured account (400 days)', () => {
    expect(pickAgeTier(tiers, 400)).toBe(0.5);
  });

  it('falls back to 1x when accountAgeDays is undefined', () => {
    expect(pickAgeTier(tiers, undefined)).toBe(1);
  });

  it('falls back to 1x when tiers are empty', () => {
    expect(pickAgeTier([], 5)).toBe(1);
  });

  it('normalizes tier order before picking (resilient to misordered input)', () => {
    const reversed = [...tiers].reverse();
    expect(pickAgeTier(reversed, 3)).toBe(2);
  });
});

describe('evaluateRateLimit -- tier-aware', () => {
  const tiers = [
    { maxAgeDays: 7, windowMultiplier: 2 },
    { maxAgeDays: 30, windowMultiplier: 1 },
    { maxAgeDays: Number.MAX_SAFE_INTEGER, windowMultiplier: 0.5 },
  ];

  it('brand-new account gets 2x window (48h cooldown for 24h base)', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 30 * 3600_000 };
    // 30h elapsed; 48h effective window -> rate-limited with 18h to wait
    const r = evaluateRateLimit({
      prior,
      newPostId: 't3_y',
      newPostTimeMs: now,
      windowSec: baseWindow,
      accountAgeDays: 3,
      ageTiers: tiers,
    });
    expect(r.rateLimited).toBe(true);
    expect(r.effectiveWindowSec).toBe(baseWindow * 2);
    expect(r.tierMultiplier).toBe(2);
    expect(r.waitSeconds).toBe(baseWindow * 2 - 30 * 3600);
  });

  it('trusted account (400 days) gets 0.5x window -- 30h elapsed lets them post', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 30 * 3600_000 };
    const r = evaluateRateLimit({
      prior,
      newPostId: 't3_y',
      newPostTimeMs: now,
      windowSec: baseWindow,
      accountAgeDays: 400,
      ageTiers: tiers,
    });
    expect(r.rateLimited).toBe(false);
    expect(r.tierMultiplier).toBe(0.5);
  });

  it('multiplier of 0 effectively disables the rule (no rate limit ever)', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 60_000 };
    const r = evaluateRateLimit({
      prior,
      newPostId: 't3_y',
      newPostTimeMs: now,
      windowSec: baseWindow,
      accountAgeDays: 9999,
      ageTiers: [{ maxAgeDays: Number.MAX_SAFE_INTEGER, windowMultiplier: 0 }],
    });
    expect(r.rateLimited).toBe(false);
    expect(r.effectiveWindowSec).toBe(0);
  });
});

describe('englishifyTime', () => {
  it('formats hours and minutes', () => {
    expect(englishifyTime(99000)).toBe('27 hours, 30 minutes');
  });

  it('falls back to seconds when sub-minute', () => {
    expect(englishifyTime(45)).toBe('45 seconds');
  });

  it('handles zero', () => {
    expect(englishifyTime(0)).toBe('0 seconds');
  });
});
