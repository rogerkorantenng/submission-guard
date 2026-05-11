import type { Context } from '@devvit/public-api';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';

export interface ReapproveInput {
  postId: string;
}

/**
 * One-click reapproval from the mod panel's enforcement feed. Calls
 * `post.approve()` on the Reddit side. Note: the bot's distinguished
 * removal comment remains on the thread for transparency — the mod can
 * delete it manually if desired.
 */
export async function reapproveHandler(
  context: Context,
  payload: unknown,
): Promise<{ ok: true } | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  await whoami(context);
  const body = (payload ?? {}) as Partial<ReapproveInput>;
  if (typeof body.postId !== 'string' || !body.postId) return { error: 'postId required' };
  try {
    const post = await context.reddit.getPostById(body.postId);
    await post.approve();
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}
