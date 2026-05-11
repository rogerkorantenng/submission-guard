import type { TriggerContext } from '@devvit/public-api';
import type { CachedSubmission } from '@shared/types';
import { keys, TTL } from '../lib/redis-keys';
import { getGuardSettings } from '../lib/settings';
import { isSeriesByFlair } from '../lib/rules/seriesDetect';
import {
  buildSeriesAuthorDm,
  buildSeriesReminderComment,
} from '../lib/messages';

/**
 * Retroactive series detection. When a moderator manually applies the
 * configured series flair to a post that Submission Guard had already
 * accepted (because it didn't have a series title tag at submission), we
 * want to retroactively fire the series flow -- post the locked sticky
 * UpdateMeBot reminder + DM the author.
 *
 * This handler watches `ModAction` and reacts to flair-edit events. It's
 * idempotent: each Submission row carries a `sentSeriesPm` flag we flip
 * once the reminder has fired.
 *
 * Mirrors `nosleepautobot.AutoBot.process_previous()` (the hourly
 * post-cache scan) but using events instead of polling.
 */
interface ModActionInput {
  action?: string;
  moderator?: { name?: string };
  targetPost?: { id?: string; linkFlair?: { cssClass?: string } };
  subreddit?: { name?: string; id?: string };
}

const FLAIR_ACTIONS = new Set(['editflair', 'addlink', 'flairedit']);

export async function handleModAction(
  event: ModActionInput,
  ctx: TriggerContext,
): Promise<void> {
  if (!event.action || !FLAIR_ACTIONS.has(event.action)) return;
  const sub = event.subreddit?.name ?? event.subreddit?.id;
  const postId = event.targetPost?.id;
  if (!sub || !postId) return;

  const settings = await getGuardSettings(ctx, sub);
  if (!settings.enableSeriesAutoFlair || !settings.enableSeriesReminderComment) return;

  // Read the cached submission. If we've already sent the series PM, bail.
  const raw = await ctx.redis.get(keys.submission(sub, postId)).catch(() => null);
  if (!raw) return; // not a post we tracked
  let cached: CachedSubmission;
  try {
    cached = JSON.parse(raw) as CachedSubmission;
  } catch {
    return;
  }
  if (cached.sentSeriesPm) return;

  // Read the live post's flair to confirm a mod has just applied the
  // configured series CSS class.
  let livePost: Awaited<ReturnType<typeof ctx.reddit.getPostById>> | null = null;
  try {
    livePost = await ctx.reddit.getPostById(postId);
  } catch (err) {
    console.error('[onModAction] getPostById failed', err);
    return;
  }

  const flairCssClass =
    (livePost as unknown as { linkFlair?: { cssClass?: string } }).linkFlair?.cssClass ??
    event.targetPost?.linkFlair?.cssClass ??
    null;
  const isSeries = isSeriesByFlair({
    flairCssClass,
    configuredSeriesClass: settings.seriesFlairCssClass,
  });
  if (!isSeries) return;

  // Apply the series flow: post sticky locked reminder + DM author.
  try {
    const reminderBody = buildSeriesReminderComment({
      authorName: cached.author,
      subreddit: sub,
    });
    const reply = await livePost.addComment({ text: reminderBody });
    await reply.distinguish(true);
    await reply.lock();
  } catch (err) {
    console.error('[onModAction] retro series comment failed', err);
  }
  try {
    const { subject, body } = buildSeriesAuthorDm({
      authorName: cached.author,
      subreddit: sub,
    });
    await ctx.reddit.sendPrivateMessage({ to: cached.author, subject, text: body });
  } catch (err) {
    console.error('[onModAction] retro series DM failed', err);
  }

  // Flip the sentSeriesPm flag so we don't re-fire on subsequent flair edits.
  await ctx.redis
    .set(
      keys.submission(sub, postId),
      JSON.stringify({ ...cached, series: true, sentSeriesPm: true }),
      { expiration: new Date(Date.now() + TTL.submissionSec * 1000) },
    )
    .catch(() => undefined);

  console.log(
    `[onModAction] retro series flow fired sub=${sub} post=${postId} by=${event.moderator?.name ?? '?'}`,
  );
}
