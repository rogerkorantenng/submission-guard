/**
 * Rate-limit enforcement. Port of `AutoBot.reject_by_timelimit()` in the
 * original `autobot/autobot.py`.
 *
 * Returns the result of comparing a new submission's timestamp against the
 * caller's prior `AuthorActivity` row. Pure -- the I/O of reading/writing
 * Redis and of checking whether the prior post was deleted lives in the
 * trigger handler.
 *
 * Edge cases preserved from the source:
 *  - If `priorActivity.lastPostId === post.id`, this is a re-process of the
 *    same post (e.g. trigger re-fired) -- treat as not-rate-limited.
 *  - If the caller has previously posted but deletion of that prior post
 *    has been confirmed by the caller, this function expects to NOT be
 *    invoked at all (deletion is the trigger handler's responsibility).
 */

import type { AuthorActivity } from '@shared/types';

export interface RateLimitDecision {
  rateLimited: boolean;
  /** Seconds until the author can post again. 0 if not rate-limited. */
  waitSeconds: number;
  /** Effective window used (after applying tier multiplier). For modmail copy. */
  effectiveWindowSec: number;
  /** The multiplier that was picked (1.0 if no tiers configured). */
  tierMultiplier: number;
}

/**
 * Pick the window multiplier whose threshold the author's account age falls
 * under. The first row whose `maxAgeDays >= accountAgeDays` wins (rows are
 * expected to be sorted ascending by maxAgeDays).
 */
export function pickAgeTier(
  tiers: ReadonlyArray<{ maxAgeDays: number; windowMultiplier: number }> | undefined,
  accountAgeDays: number | undefined,
): number {
  if (!tiers || tiers.length === 0) return 1;
  if (accountAgeDays == null || !Number.isFinite(accountAgeDays)) return 1;
  const sorted = [...tiers].sort((a, b) => a.maxAgeDays - b.maxAgeDays);
  for (const tier of sorted) {
    if (accountAgeDays <= tier.maxAgeDays) return tier.windowMultiplier;
  }
  return sorted[sorted.length - 1]!.windowMultiplier;
}

export function evaluateRateLimit(args: {
  prior: AuthorActivity | null;
  newPostId: string;
  newPostTimeMs: number;
  windowSec: number;
  /** Account age in days. When omitted, tier logic is bypassed. */
  accountAgeDays?: number;
  /** Account-age tiers (sorted ascending by maxAgeDays). */
  ageTiers?: ReadonlyArray<{ maxAgeDays: number; windowMultiplier: number }>;
}): RateLimitDecision {
  const { prior, newPostId, newPostTimeMs, windowSec, accountAgeDays, ageTiers } = args;
  const multiplier = pickAgeTier(ageTiers, accountAgeDays);
  const effectiveWindowSec = Math.max(0, Math.floor(windowSec * multiplier));
  if (effectiveWindowSec === 0) {
    return { rateLimited: false, waitSeconds: 0, effectiveWindowSec: 0, tierMultiplier: multiplier };
  }
  if (!prior) {
    return { rateLimited: false, waitSeconds: 0, effectiveWindowSec, tierMultiplier: multiplier };
  }
  if (prior.lastPostId === newPostId) {
    return { rateLimited: false, waitSeconds: 0, effectiveWindowSec, tierMultiplier: multiplier };
  }
  const elapsedSec = Math.floor((newPostTimeMs - prior.lastPostTimeMs) / 1000);
  if (elapsedSec >= effectiveWindowSec) {
    return { rateLimited: false, waitSeconds: 0, effectiveWindowSec, tierMultiplier: multiplier };
  }
  return {
    rateLimited: true,
    waitSeconds: effectiveWindowSec - elapsedSec,
    effectiveWindowSec,
    tierMultiplier: multiplier,
  };
}

/**
 * Render a wait time as a human phrase. Port of `englishify_time()` in the
 * original. "5400 seconds" -> "1 hour, 30 minutes".
 */
export function englishifyTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  if (parts.length === 0) return '0 seconds';
  return parts.join(', ');
}
