import type { Context } from '@devvit/public-api';
import type { GuardSettings } from '@shared/types';
import { keys } from './redis-keys';

type RedisCtx = Pick<Context, 'redis'>;

/**
 * Default Submission Guard settings. Matches the original `nosleepautobot`
 * envvar defaults, with all rules enabled.
 */
export const DEFAULTS: GuardSettings = {
  enableTitleTags: true,
  enableNsfwTitle: true,
  enableLongParagraph: true,
  enableCodeBlock: true,
  enableRateLimit: true,
  enableSeriesAutoFlair: true,
  customTitleTagPatterns: [],
  maxWordsPerParagraph: 350,
  rateLimitWindowSec: 86_400,
  // Account-age-aware rate limit tiers. Brand-new accounts get 2x cooldown,
  // long-tenured accounts get 0.5x. The trigger handler picks the FIRST
  // matching tier (lowest `maxAgeDays` >= the author's age in days).
  accountAgeRateLimitTiers: [
    { maxAgeDays: 7, windowMultiplier: 2 },
    { maxAgeDays: 30, windowMultiplier: 1 },
    { maxAgeDays: Number.MAX_SAFE_INTEGER, windowMultiplier: 0.5 },
  ],
  seriesFlairCssClass: 'flair-series',
  enableSeriesReminderComment: true,
  enableEscalation: true,
  escalation: {
    warnThreshold: 1, // 1st violation: warn comment, no removal
    removeThreshold: 2, // 2nd violation: standard remove
    windowSec: 7 * 86_400, // rolling 7-day window
  },
  enableRaidDetection: true,
  raid: {
    minDistinctAuthors: 5, // 5 authors hitting same rule in 5min = raid
    windowSec: 300,
  },
};

/**
 * Reads merged GuardSettings for a sub. A missing or unparseable blob
 * returns DEFAULTS -- settings are presentation/configuration metadata,
 * never load-bearing, so we degrade silently.
 */
export async function getGuardSettings(ctx: RedisCtx, sub: string): Promise<GuardSettings> {
  const raw = await ctx.redis.get(keys.settings(sub));
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<GuardSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function saveGuardSettings(
  ctx: RedisCtx,
  sub: string,
  next: Partial<GuardSettings>,
): Promise<GuardSettings> {
  const cur = await getGuardSettings(ctx, sub);
  const merged: GuardSettings = { ...cur, ...next };
  await ctx.redis.set(keys.settings(sub), JSON.stringify(merged));
  return merged;
}
