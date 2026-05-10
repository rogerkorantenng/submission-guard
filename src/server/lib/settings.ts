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
  seriesFlairCssClass: 'flair-series',
  enableSeriesReminderComment: true,
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
