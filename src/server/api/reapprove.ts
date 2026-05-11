import type { Context } from '@devvit/public-api';
import type { EnforcementEvent } from '@shared/types';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';
import { keys } from '../lib/redis-keys';

export interface ReapproveInput {
  postId: string;
}

/**
 * One-click reapproval from the mod panel's enforcement feed. Calls
 * `post.approve()` on the Reddit side and marks the enforcement event
 * as reapproved in Redis. Note: the bot's distinguished removal comment
 * remains on the thread for transparency — the mod can delete it manually.
 */
export async function reapproveHandler(
  context: Context,
  payload: unknown,
): Promise<{ ok: true } | { error: string }> {
  if (!(await isCallerMod(context))) {
    console.log('[reapprove] Forbidden: caller is not a mod');
    return { error: 'forbidden' };
  }

  const me = await whoami(context);
  const body = (payload ?? {}) as Partial<ReapproveInput>;

  if (typeof body.postId !== 'string' || !body.postId) {
    console.log('[reapprove] Bad request: missing postId');
    return { error: 'postId required' };
  }

  console.log(`[reapprove] Starting reapproval for postId=${body.postId}`);

  try {
    const post = await context.reddit.getPostById(body.postId);
    console.log(`[reapprove] Fetched post from Reddit: ${post.id}, sub=${post.subredditName}`);

    await post.approve();
    console.log(`[reapprove] Post approved on Reddit`);

    // Store reapproval metadata in a separate hash (simpler than modifying sorted set)
    const sub = post.subredditName;
    const reapprovalKey = keys.reapprovals(sub);
    const reapprovalData = JSON.stringify({
      reapprovedBy: me.modName ?? 'unknown',
      reapprovedAt: Date.now(),
    });

    await context.redis.hSet(reapprovalKey, {
      [body.postId]: reapprovalData,
    });
    console.log(`[reapprove] Stored reapproval metadata for ${body.postId}`);

    return { ok: true };
  } catch (err) {
    console.error('[reapprove] Error:', err);
    return { error: String(err) };
  }
}
