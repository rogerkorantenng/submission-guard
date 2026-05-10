import type { TriggerContext } from '@devvit/public-api';
import type { AuthorActivity, CachedSubmission, EnforcementEvent } from '@shared/types';
import { keys, TTL } from '../lib/redis-keys';
import { evaluateSubmission } from '../lib/evaluate';
import { getGuardSettings } from '../lib/settings';
import {
  buildRemovalComment,
  buildSeriesAuthorDm,
  buildSeriesReminderComment,
} from '../lib/messages';
import { isSeriesByFlair } from '../lib/rules/seriesDetect';

interface PostSubmitPayload {
  post?: {
    id?: string;
    title?: string;
    selftext?: string;
    body?: string;
    authorId?: string;
    authorName?: string;
    author?: string;
    permalink?: string;
    createdAt?: { getTime?: () => number } | number | string;
    linkFlair?: { cssClass?: string };
  };
  author?: { name?: string; id?: string };
  subreddit?: { name?: string; id?: string };
}

function toMs(v: { getTime?: () => number } | number | string | undefined): number {
  if (v == null) return Date.now();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  if (typeof v === 'object' && typeof v.getTime === 'function') return v.getTime();
  return Date.now();
}

function readSubName(p: PostSubmitPayload): string | undefined {
  return p.subreddit?.name ?? p.subreddit?.id;
}

function readAuthor(p: PostSubmitPayload): string {
  const candidate =
    p.post?.authorName ?? p.author?.name ?? p.post?.author ?? '';
  if (candidate && !candidate.startsWith('t2_')) return candidate;
  return '[deleted]';
}

async function readPriorActivity(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  author: string,
): Promise<AuthorActivity | null> {
  const raw = await ctx.redis.get(keys.activity(sub, author));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthorActivity;
  } catch {
    return null;
  }
}

async function persistSubmission(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  s: CachedSubmission,
): Promise<void> {
  await ctx.redis.set(keys.submission(sub, s.id), JSON.stringify(s), {
    expiration: new Date(Date.now() + TTL.submissionSec * 1000),
  });
}

async function persistActivity(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  windowSec: number,
  author: string,
  postId: string,
  postTimeMs: number,
): Promise<void> {
  const elapsedSec = Math.floor((Date.now() - postTimeMs) / 1000);
  const remaining = Math.max(60, windowSec - elapsedSec);
  const row: AuthorActivity = { author, lastPostId: postId, lastPostTimeMs: postTimeMs };
  await ctx.redis.set(keys.activity(sub, author), JSON.stringify(row), {
    expiration: new Date(Date.now() + remaining * 1000),
  });
}

async function recordEnforcement(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  ev: EnforcementEvent,
): Promise<void> {
  await ctx.redis
    .zAdd(keys.enforcementFeed(sub), { score: ev.ts, member: JSON.stringify(ev) })
    .catch(() => undefined);
}

/**
 * Devvit `PostSubmit` handler. Runs every Submission Guard rule against the
 * incoming post and applies the appropriate action.
 *
 * Behavior parity with the original `nosleepautobot/AutoBot.handle_post()`:
 *  - Idempotent: if we already cached this submission, skip.
 *  - First violation wins; remove + reply with a sticky distinguished
 *    comment containing a pre-filled modmail link.
 *  - On accept: persist the submission + author activity (for rate-limit
 *    cache) and run the series flow (auto-flair + reminder comment + DM).
 *  - On rate-limit removal: do NOT update activity (the original keeps the
 *    earlier `last_post_time` so the cooldown still elapses correctly).
 */
export async function onPostSubmit(
  event: PostSubmitPayload,
  ctx: TriggerContext,
): Promise<void> {
  const sub = readSubName(event);
  const post = event.post;
  if (!sub || !post?.id) return;
  const postId: string = post.id;

  // Dedupe: bail if we already recorded this submission.
  const existingRaw = await ctx.redis.get(keys.submission(sub, postId)).catch(() => null);
  if (existingRaw) return;

  const settings = await getGuardSettings(ctx, sub);
  const author = readAuthor(event);
  const title = post.title ?? '';
  const body = post.selftext ?? post.body ?? '';
  const createdAtMs = toMs(post.createdAt);
  const flairCssClass = post.linkFlair?.cssClass ?? null;
  const prior = await readPriorActivity(ctx, sub, author);

  const result = evaluateSubmission({
    postId: postId,
    authorName: author,
    title,
    body,
    createdAtMs,
    flairCssClass,
    priorActivity: prior,
    settings,
  });

  // Resolve the live Reddit Post object once if we'll need it for actions.
  let livePost: Awaited<ReturnType<typeof ctx.reddit.getPostById>> | null = null;
  async function loadLivePost() {
    if (livePost) return livePost;
    try {
      livePost = await ctx.reddit.getPostById(postId!);
    } catch (err) {
      console.error('[onPostSubmit] getPostById failed', err);
      livePost = null;
    }
    return livePost;
  }

  if (result.type === 'remove') {
    const live = await loadLivePost();
    if (live) {
      try {
        await live.remove(false);
      } catch (err) {
        console.error('[onPostSubmit] remove failed', err);
      }
      try {
        const body = buildRemovalComment({
          authorName: author,
          subreddit: sub,
          postTitle: title,
          permalink: post.permalink ?? '',
          reason: result.reason,
          detail: result.detail,
          waitPhrase: result.waitPhrase,
          allowReapproval: result.allowReapproval,
        });
        const reply = await live.addComment({ text: body });
        await reply.distinguish(true);
      } catch (err) {
        console.error('[onPostSubmit] reply failed', err);
      }
    }
    await recordEnforcement(ctx, sub, {
      id: `${createdAtMs}-${postId}`,
      postId: postId,
      authorName: author,
      title,
      reason: result.reason,
      detail: result.detail,
      ts: createdAtMs,
      permalink: post.permalink ?? '',
    });
    // Persist the submission row (so we don't re-process). Do NOT bump
    // activity for rate-limit removals -- the existing activity row keeps
    // the cooldown clock honest.
    await persistSubmission(ctx, sub, {
      id: postId,
      author,
      submittedMs: createdAtMs,
      series: result.isSeries,
      sentSeriesPm: false,
    });
    console.log(`[onPostSubmit] sub=${sub} post=${postId} REMOVED reason=${result.reason}`);
    return;
  }

  // Accept path: persist submission + activity, then handle series flow.
  await persistSubmission(ctx, sub, {
    id: postId,
    author,
    submittedMs: createdAtMs,
    series: result.isSeries,
    sentSeriesPm: false,
  });
  await persistActivity(ctx, sub, settings.rateLimitWindowSec, author, postId, createdAtMs);

  // Series detection: either rule-detected via title tag, OR mod has already
  // applied the configured series CSS class.
  const seriesByMod = isSeriesByFlair({
    flairCssClass,
    configuredSeriesClass: settings.seriesFlairCssClass,
  });
  const shouldHandleSeries =
    settings.enableSeriesAutoFlair && (result.isSeries || seriesByMod) && !result.isFinal;

  if (shouldHandleSeries) {
    const live = await loadLivePost();
    if (live) {
      // Auto-apply series flair if not already there. We intentionally do
      // NOT enumerate flair templates here -- Devvit's setFlair takes a
      // CSS class string directly via the sub's flair templates API.
      if (!seriesByMod) {
        try {
          await ctx.reddit.setPostFlair({
            postId: postId,
            subredditName: sub,
            cssClass: settings.seriesFlairCssClass,
          });
        } catch (err) {
          console.error('[onPostSubmit] setPostFlair failed', err);
        }
      }

      if (settings.enableSeriesReminderComment) {
        try {
          const reminderBody = buildSeriesReminderComment({ authorName: author, subreddit: sub });
          const reply = await live.addComment({ text: reminderBody });
          await reply.distinguish(true);
          await reply.lock();
        } catch (err) {
          console.error('[onPostSubmit] series reminder failed', err);
        }
        try {
          const { subject, body: dmBody } = buildSeriesAuthorDm({
            authorName: author,
            subreddit: sub,
          });
          await ctx.reddit.sendPrivateMessage({ to: author, subject, text: dmBody });
        } catch (err) {
          console.error('[onPostSubmit] author DM failed', err);
        }
      }

      // Mark the cached submission so we don't redundantly DM/comment on
      // retroactive series detection.
      await persistSubmission(ctx, sub, {
        id: postId,
        author,
        submittedMs: createdAtMs,
        series: true,
        sentSeriesPm: true,
      });
    }
  }

  console.log(
    `[onPostSubmit] sub=${sub} post=${postId} ACCEPTED series=${result.isSeries} final=${result.isFinal}`,
  );
}
