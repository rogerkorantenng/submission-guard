import type { RemovalReason } from '@shared/types';

/**
 * Removal-comment templates. Ported from the Mako templates in
 * `autobot/util/messages/templates/`.
 *
 * Each template returns a Markdown body the bot will post as a sticky,
 * distinguished reply on the removed post. The body always includes a
 * pre-filled modmail link the author can click to request reapproval.
 */

export interface RemovalContext {
  authorName: string;
  subreddit: string;
  postTitle: string;
  permalink: string;
  reason: RemovalReason;
  detail: string;
  /** For rate-limit removals: human-readable wait phrase (e.g. "1 hour, 30 minutes"). */
  waitPhrase?: string;
  /** Allows reapproval modmail flow when true (else author must wait or repost). */
  allowReapproval: boolean;
}

function modmailLink(args: {
  subreddit: string;
  subject: string;
  body: string;
}): string {
  const params = new URLSearchParams({
    subject: args.subject,
    message: args.body,
  });
  return `https://www.reddit.com/message/compose?to=${encodeURIComponent('/r/' + args.subreddit)}&${params.toString()}`;
}

const REASON_HEADLINES: Record<RemovalReason, string> = {
  'invalid-tags': 'unrecognized title tag(s)',
  'nsfw-in-title': 'NSFW in title text',
  'long-paragraph': 'paragraph exceeds the word cap',
  'code-block': 'body contains code blocks (4-space indent or tab)',
  'rate-limit': 'you posted too recently',
};

const REPOST_GUIDANCE: Partial<Record<RemovalReason, string>> = {
  'nsfw-in-title':
    'You may delete this post and resubmit ONCE with the NSFW token removed from the title and Reddit\'s native NSFW tag toggled on.',
  'rate-limit':
    'Please wait until the cooldown elapses before posting again.',
};

const REAPPROVAL_GUIDANCE: Partial<Record<RemovalReason, string>> = {
  'invalid-tags':
    'Do NOT delete this post. Click the modmail link below to ask the moderators for a corrected title -- they can rename and reapprove it for you.',
  'long-paragraph':
    'Edit the post to break the offending paragraph into shorter ones, then click the modmail link below to request reapproval.',
  'code-block':
    'Edit the post to remove the leading whitespace (4-space indent or tab) on the offending paragraph, then click the modmail link below to request reapproval.',
};

export function buildRemovalComment(ctx: RemovalContext): string {
  const headline = REASON_HEADLINES[ctx.reason];
  const guidance = ctx.allowReapproval
    ? REAPPROVAL_GUIDANCE[ctx.reason] ??
      'Edit the post to address the issue, then modmail the moderators to request reapproval.'
    : REPOST_GUIDANCE[ctx.reason] ?? 'See the moderators for next steps.';

  const modmail = modmailLink({
    subreddit: ctx.subreddit,
    subject: `Submission Guard re-approval request — ${ctx.postTitle.slice(0, 80)}`,
    body: [
      `Hi mods,`,
      ``,
      `Submission Guard removed my post ([link](${ctx.permalink})) for: ${headline}.`,
      ``,
      `Detail: ${ctx.detail}`,
      ``,
      `I have addressed the issue and would like the post reapproved. Thank you.`,
    ].join('\n'),
  });

  const lines: string[] = [
    `Hi u/${ctx.authorName} -- this post was automatically removed by Submission Guard.`,
    ``,
    `**Reason:** ${headline}`,
    `**Detail:** ${ctx.detail}`,
  ];
  if (ctx.reason === 'rate-limit' && ctx.waitPhrase) {
    lines.push(`**Wait time remaining:** ${ctx.waitPhrase}`);
  }
  lines.push('');
  lines.push(guidance);
  lines.push('');
  lines.push(`[Message the moderators with one click](${modmail}).`);
  lines.push('');
  lines.push(
    `*Submission Guard is a moderation tool installed by the r/${ctx.subreddit} mod team. Settings (rule thresholds, allowed tags) are configured per-subreddit.*`,
  );
  return lines.join('\n');
}

export interface SeriesReminderContext {
  authorName: string;
  subreddit: string;
}

/** Locked, sticky, distinguished reply pointing readers to UpdateMeBot. */
export function buildSeriesReminderComment(ctx: SeriesReminderContext): string {
  const compose = `https://www.reddit.com/message/compose?to=UpdateMeBot&subject=Subscribe&message=${encodeURIComponent(
    `SubscribeMe! /r/${ctx.subreddit} /u/${ctx.authorName}`,
  )}`;
  return [
    `**Looks like this is a series.** Want to be notified when u/${ctx.authorName} posts the next part?`,
    ``,
    `[Click here to subscribe via UpdateMeBot](${compose}).`,
    ``,
    `*This comment was placed automatically by Submission Guard because the post is flaired as a series.*`,
  ].join('\n');
}

export function buildSeriesAuthorDm(ctx: SeriesReminderContext): { subject: string; body: string } {
  return {
    subject: `Your series post in r/${ctx.subreddit}`,
    body: [
      `Hi u/${ctx.authorName},`,
      ``,
      `Your post in r/${ctx.subreddit} has been flaired as part of a series. A reminder comment has been added so other readers can subscribe to be notified when you post the next part.`,
      ``,
      `Thank you for posting!`,
      `-- Submission Guard`,
    ].join('\n'),
  };
}
