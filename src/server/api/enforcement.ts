import type { Context } from '@devvit/public-api';
import type { EnforcementEvent } from '@shared/types';
import { keys, TTL } from '../lib/redis-keys';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';

type RedisCtx = Pick<Context, 'redis'>;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function safeParse(raw: string): EnforcementEvent | null {
  try {
    const parsed = JSON.parse(raw) as EnforcementEvent;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.postId === 'string') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Returns the most-recent enforcement events for the sub, newest first. */
export async function readEnforcementFeed(
  ctx: RedisCtx,
  sub: string,
  limit = DEFAULT_LIMIT,
): Promise<EnforcementEvent[]> {
  const cap = Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
  const raw = await ctx.redis
    .zRange(keys.enforcementFeed(sub), 0, cap - 1, { by: 'rank', reverse: true })
    .catch(() => [] as Array<{ member: string } | string>);
  const out: EnforcementEvent[] = [];
  for (const m of raw) {
    const member = typeof m === 'string' ? m : m.member;
    const ev = safeParse(member);
    if (ev) out.push(ev);
  }
  return out;
}

export async function enforcementListHandler(
  context: Context,
  payload: unknown,
): Promise<{ events: EnforcementEvent[] } | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  const body = (payload ?? {}) as { limit?: unknown };
  const limit = typeof body.limit === 'number' ? body.limit : DEFAULT_LIMIT;
  try {
    const events = await readEnforcementFeed(context, me.subreddit, limit);

    // Merge reapproval metadata from separate hash
    const reapprovalKey = keys.reapprovals(me.subreddit);
    const reapprovals = await context.redis.hGetAll(reapprovalKey).catch(() => ({}));

    for (const ev of events) {
      const reapprovalJson = reapprovals[ev.postId];
      if (reapprovalJson) {
        try {
          const { reapprovedBy, reapprovedAt } = JSON.parse(reapprovalJson);
          ev.reapproved = true;
          ev.reapprovedBy = reapprovedBy;
          ev.reapprovedAt = reapprovedAt;
        } catch {
          // ignore parse errors
        }
      }
    }

    return { events };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Trim the enforcement feed sorted set to its cap. Called periodically by
 * the scheduler so the feed doesn't grow unbounded.
 */
export async function trimEnforcementFeed(ctx: RedisCtx, sub: string): Promise<void> {
  // zRemRangeByRank: keep the top N (newest are highest score). Drop
  // everything beyond the cap (rank index from 0..-cap-1 from the bottom).
  await ctx.redis
    .zRemRangeByRank(keys.enforcementFeed(sub), 0, -TTL.feedCapMembers - 1)
    .catch(() => undefined);
}
