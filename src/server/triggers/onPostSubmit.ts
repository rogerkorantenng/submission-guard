import type { TriggerContext } from '@devvit/public-api';
import type { AuthorActivity, CachedSubmission, EnforcementEvent, RemovalReason } from '@shared/types';
import { keys, TTL } from '../lib/redis-keys';
import { evaluateSubmission } from '../lib/evaluate';
import { getGuardSettings } from '../lib/settings';
import {
  buildRemovalComment,
  buildSeriesAuthorDm,
  buildSeriesReminderComment,
} from '../lib/messages';
import { isSeriesByFlair } from '../lib/rules/seriesDetect';
import { decideEscalation, decideRaidAlert } from '../lib/escalation';

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
 * Reads the count of prior violations by `author` in the rolling window.
 * Trims expired entries opportunistically before counting so the sorted
 * set stays bounded. The "current" violation is NOT included; the caller
 * appends it after deciding the action.
 */
async function countPriorViolations(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  author: string,
  windowSec: number,
): Promise<number> {
  const key = keys.violations(sub, author);
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  // zRemRangeByScore: drop everything older than the window.
  await ctx.redis.zRemRangeByScore(key, 0, windowStart - 1).catch(() => undefined);
  // zRange by score to count within-window members.
  const members = await ctx.redis
    .zRange(key, windowStart, '+inf', { by: 'score' })
    .catch(() => [] as Array<{ member: string } | string>);
  return Array.isArray(members) ? members.length : 0;
}

/** Append the current violation to the rolling window. */
async function appendViolation(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  author: string,
  reason: RemovalReason,
  ts: number,
  windowSec: number,
): Promise<void> {
  await ctx.redis
    .zAdd(keys.violations(sub, author), { score: ts, member: `${ts}-${reason}` })
    .catch(() => undefined);
  // Refresh key TTL so unmaintained authors fall off entirely after the window.
  await ctx.redis.expire(keys.violations(sub, author), windowSec).catch(() => undefined);
}

/**
 * Append the (reason, author) pair to the rolling per-rule hit set used by
 * raid detection, then count distinct authors within the window.
 */
async function recordRuleHitAndCount(
  ctx: Pick<TriggerContext, 'redis'>,
  sub: string,
  reason: RemovalReason,
  author: string,
  ts: number,
  windowSec: number,
): Promise<number> {
  const key = keys.ruleHits(sub, reason);
  const windowStart = ts - windowSec * 1000;
  await ctx.redis.zRemRangeByScore(key, 0, windowStart - 1).catch(() => undefined);
  // member is the author name; if the same author hits the rule twice in the
  // window, zAdd just updates the score -- distinct-author count is the
  // current member count.
  await ctx.redis.zAdd(key, { score: ts, member: author }).catch(() => undefined);
  await ctx.redis.expire(key, windowSec).catch(() => undefined);
  const members = await ctx.redis
    .zRange(key, windowStart, '+inf', { by: 'score' })
    .catch(() => [] as Array<{ member: string } | string>);
  return Array.isArray(members) ? members.length : 0;
}

/**
 * Modmail mods about a possible raid. Idempotent within the raid window via
 * an alert-sent marker key. Best-effort: any failure is logged and swallowed.
 */
async function maybeAlertModsAboutRaid(
  ctx: Pick<TriggerContext, 'redis' | 'reddit'>,
  sub: string,
  reason: RemovalReason,
  distinctAuthors: number,
  windowSec: number,
): Promise<void> {
  const markerKey = keys.raidAlertSent(sub, reason);
  const already = await ctx.redis.get(markerKey).catch(() => null);
  if (already) return;
  try {
    await ctx.reddit.modMail.createConversation({
      subredditName: sub,
      subject: `Submission Guard: possible raid -- ${distinctAuthors} hits on "${reason}" in ${windowSec}s`,
      body: [
        `Submission Guard detected an unusual cluster of "${reason}" violations:`,
        ``,
        `**${distinctAuthors} distinct authors** hit this rule within the last ${windowSec} seconds.`,
        ``,
        `This often signals a coordinated raid, a script attack, or a misconfigured rule. Consider locking new submissions, switching the sub to restricted mode, or reviewing the recent enforcement feed in the Submission Guard mod panel.`,
        ``,
        `This alert is rate-limited to once per raid window. If the cluster continues, you will only receive one notification.`,
      ].join('\n'),
      isAuthorHidden: false,
      to: null,
    });
    await ctx.redis
      .set(markerKey, '1', { expiration: new Date(Date.now() + windowSec * 1000) })
      .catch(() => undefined);
  } catch (err) {
    console.error('[onPostSubmit] raid alert modmail failed', err);
  }
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

  // Resolve author account age in days. This is one of the unique value-adds
  // over AutoModerator, which has no access to account_age. If the lookup
  // fails (deleted account, transient API hiccup), accountAgeDays stays
  // undefined and the rate-limit tier logic falls back to the 1x multiplier.
  let accountAgeDays: number | undefined;
  const authorId = event.author?.id ?? event.post?.authorId;
  if (authorId) {
    try {
      const u = await ctx.reddit.getUserById(authorId);
      if (u?.createdAt instanceof Date) {
        accountAgeDays = Math.max(0, Math.floor((Date.now() - u.createdAt.getTime()) / 86_400_000));
      }
    } catch {
      // Defensive: tier multiplier just falls back to 1x.
    }
  }

  const result = evaluateSubmission({
    postId,
    authorName: author,
    title,
    body,
    createdAtMs,
    flairCssClass,
    priorActivity: prior,
    accountAgeDays,
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
    // Decide escalation action based on prior violations in the rolling window.
    let action: 'warn' | 'remove' | 'remove-and-alert' = 'remove';
    if (settings.enableEscalation) {
      const priorCount = await countPriorViolations(
        ctx,
        sub,
        author,
        settings.escalation.windowSec,
      );
      action = decideEscalation(priorCount, {
        warnThreshold: settings.escalation.warnThreshold,
        removeThreshold: settings.escalation.removeThreshold,
      });
    }

    const live = await loadLivePost();
    if (live) {
      // Only remove on remove/remove-and-alert; warn leaves the post up.
      if (action !== 'warn') {
        try {
          await live.remove(false);
        } catch (err) {
          console.error('[onPostSubmit] remove failed', err);
        }
      }
      try {
        const warnPrefix =
          action === 'warn'
            ? `**This is a warning, not a removal yet.** Your post stays up. The next violation in this window will result in a removal.\n\n`
            : action === 'remove-and-alert'
              ? `**Repeated violations.** The mod team has been notified.\n\n`
              : '';
        const body =
          warnPrefix +
          buildRemovalComment({
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

    // Append this violation to the rolling per-author counter, then run raid
    // detection if enabled.
    if (settings.enableEscalation) {
      await appendViolation(
        ctx,
        sub,
        author,
        result.reason,
        createdAtMs,
        settings.escalation.windowSec,
      );
    }
    if (settings.enableRaidDetection) {
      const distinct = await recordRuleHitAndCount(
        ctx,
        sub,
        result.reason,
        author,
        createdAtMs,
        settings.raid.windowSec,
      );
      if (decideRaidAlert(distinct, { minDistinctAuthors: settings.raid.minDistinctAuthors }, result.reason)) {
        await maybeAlertModsAboutRaid(
          ctx,
          sub,
          result.reason,
          distinct,
          settings.raid.windowSec,
        );
      }
    }

    await recordEnforcement(ctx, sub, {
      id: `${createdAtMs}-${postId}`,
      postId: postId,
      authorName: author,
      title,
      reason: result.reason,
      detail: action === 'warn' ? `${result.detail} (1st-violation warning; post not removed)` : result.detail,
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
    console.log(
      `[onPostSubmit] sub=${sub} post=${postId} ${action.toUpperCase()} reason=${result.reason}`,
    );
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
