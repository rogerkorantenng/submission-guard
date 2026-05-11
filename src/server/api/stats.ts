import type { Context } from '@devvit/public-api';
import type { EnforcementEvent, RemovalReason } from '@shared/types';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';
import { readEnforcementFeed } from './enforcement';

export interface GuardStats {
  totalRemovals: number;
  windows: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  byReason: Record<RemovalReason, number>;
  topAuthors: Array<{ author: string; count: number }>;
}

const DAY_MS = 86_400_000;

function aggregate(events: EnforcementEvent[]): GuardStats {
  const now = Date.now();
  const reasonCounts: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const windows = { last24h: 0, last7d: 0, last30d: 0 };

  for (const ev of events) {
    reasonCounts[ev.reason] = (reasonCounts[ev.reason] ?? 0) + 1;
    authorCounts[ev.authorName] = (authorCounts[ev.authorName] ?? 0) + 1;
    const age = now - ev.ts;
    if (age <= DAY_MS) windows.last24h++;
    if (age <= 7 * DAY_MS) windows.last7d++;
    if (age <= 30 * DAY_MS) windows.last30d++;
  }

  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([author, count]) => ({ author, count }));

  // Ensure every RemovalReason key is present (even with 0) so the UI can
  // render a stable row order without missing-key checks.
  const ALL_REASONS: RemovalReason[] = [
    'invalid-tags',
    'nsfw-in-title',
    'long-paragraph',
    'code-block',
    'rate-limit',
  ];
  const byReason = Object.fromEntries(
    ALL_REASONS.map((r) => [r, reasonCounts[r] ?? 0]),
  ) as Record<RemovalReason, number>;

  return {
    totalRemovals: events.length,
    windows,
    byReason,
    topAuthors,
  };
}

export async function statsGetHandler(
  context: Context,
): Promise<GuardStats | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  try {
    const events = await readEnforcementFeed(context, me.subreddit, 200);
    return aggregate(events);
  } catch (err) {
    return { error: String(err) };
  }
}

// Exported for testing.
export const __test = { aggregate };
