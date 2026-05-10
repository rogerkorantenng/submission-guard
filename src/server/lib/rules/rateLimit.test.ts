import { describe, it, expect } from 'vitest';
import { englishifyTime, evaluateRateLimit } from './rateLimit';

describe('evaluateRateLimit', () => {
  const window = 86_400; // 24h
  const now = 1_700_000_000_000;

  it('not rate-limited when no prior activity', () => {
    expect(
      evaluateRateLimit({ prior: null, newPostId: 't3_x', newPostTimeMs: now, windowSec: window }),
    ).toEqual({ rateLimited: false, waitSeconds: 0 });
  });

  it('not rate-limited when re-processing same post', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 1000 };
    expect(
      evaluateRateLimit({ prior, newPostId: 't3_x', newPostTimeMs: now, windowSec: window }),
    ).toEqual({ rateLimited: false, waitSeconds: 0 });
  });

  it('rate-limited within the window', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - 3600_000 };
    const r = evaluateRateLimit({ prior, newPostId: 't3_y', newPostTimeMs: now, windowSec: window });
    expect(r.rateLimited).toBe(true);
    expect(r.waitSeconds).toBe(window - 3600);
  });

  it('not rate-limited past the window', () => {
    const prior = { author: 'a', lastPostId: 't3_x', lastPostTimeMs: now - (window + 60) * 1000 };
    expect(
      evaluateRateLimit({ prior, newPostId: 't3_y', newPostTimeMs: now, windowSec: window }),
    ).toEqual({ rateLimited: false, waitSeconds: 0 });
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
