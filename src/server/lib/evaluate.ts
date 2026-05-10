import type { AuthorActivity, GuardSettings, RemovalReason } from '@shared/types';
import { analyzeTitleTags } from './rules/titleTags';
import { containsNsfwTitle } from './rules/nsfwTitle';
import { findLongParagraphs } from './rules/longParagraphs';
import { containsCodeBlocks } from './rules/codeBlocks';
import { evaluateRateLimit, englishifyTime } from './rules/rateLimit';

export interface EvaluateInput {
  postId: string;
  authorName: string;
  title: string;
  body: string;
  createdAtMs: number;
  /** Existing flair CSS class on the post (mods may have applied series flair manually). */
  flairCssClass?: string | null;
  /** Prior activity row for the author, if any. */
  priorActivity: AuthorActivity | null;
  settings: GuardSettings;
}

export interface EvaluateRemoval {
  type: 'remove';
  reason: RemovalReason;
  detail: string;
  /** For rate-limit only: human wait phrase. */
  waitPhrase?: string;
  /** Whether the author can request mod reapproval (vs must wait/repost). */
  allowReapproval: boolean;
  /** Side-signal: rules that detected series, used by post-removal series flow. */
  isSeries: boolean;
  isFinal: boolean;
}

export interface EvaluateAccept {
  type: 'accept';
  isSeries: boolean;
  isFinal: boolean;
}

export type EvaluateResult = EvaluateRemoval | EvaluateAccept;

/**
 * Runs every enabled rule against the submission. First violation wins
 * (mirrors the original's short-circuit behavior in `AutoBot.handle_post`).
 *
 * Series detection runs even on accepted posts so the trigger can drive the
 * flair + reminder-comment + author-DM flow.
 */
export function evaluateSubmission(input: EvaluateInput): EvaluateResult {
  const s = input.settings;

  // Title-tag whitelist (also surfaces series/final signals for the accept path).
  const tagResult = s.enableTitleTags
    ? analyzeTitleTags(input.title, { customPatterns: s.customTitleTagPatterns })
    : { invalidTags: [], isSeries: false, isFinal: false };

  if (s.enableTitleTags && tagResult.invalidTags.length > 0) {
    return {
      type: 'remove',
      reason: 'invalid-tags',
      detail: `Unrecognized title tag(s): ${tagResult.invalidTags.join(', ')}`,
      allowReapproval: true,
      isSeries: tagResult.isSeries,
      isFinal: tagResult.isFinal,
    };
  }

  if (s.enableNsfwTitle && containsNsfwTitle(input.title)) {
    return {
      type: 'remove',
      reason: 'nsfw-in-title',
      detail: 'Title contains the token "NSFW". Use Reddit\'s native NSFW toggle instead.',
      allowReapproval: false,
      isSeries: tagResult.isSeries,
      isFinal: tagResult.isFinal,
    };
  }

  if (s.enableLongParagraph) {
    const long = findLongParagraphs(input.body, s.maxWordsPerParagraph);
    if (long.offending.length > 0) {
      const first = long.offending[0]!;
      return {
        type: 'remove',
        reason: 'long-paragraph',
        detail: `Paragraph ${first.index + 1} has ${first.wordCount} words (cap is ${s.maxWordsPerParagraph}).`,
        allowReapproval: true,
        isSeries: tagResult.isSeries,
        isFinal: tagResult.isFinal,
      };
    }
  }

  if (s.enableCodeBlock && containsCodeBlocks(input.body)) {
    return {
      type: 'remove',
      reason: 'code-block',
      detail: 'A paragraph starts with 4+ spaces or a tab, which Reddit renders as a code block.',
      allowReapproval: true,
      isSeries: tagResult.isSeries,
      isFinal: tagResult.isFinal,
    };
  }

  if (s.enableRateLimit) {
    const rl = evaluateRateLimit({
      prior: input.priorActivity,
      newPostId: input.postId,
      newPostTimeMs: input.createdAtMs,
      windowSec: s.rateLimitWindowSec,
    });
    if (rl.rateLimited) {
      return {
        type: 'remove',
        reason: 'rate-limit',
        detail: `Author posted within the cooldown window (${s.rateLimitWindowSec}s).`,
        waitPhrase: englishifyTime(rl.waitSeconds),
        allowReapproval: false,
        isSeries: tagResult.isSeries,
        isFinal: tagResult.isFinal,
      };
    }
  }

  return { type: 'accept', isSeries: tagResult.isSeries, isFinal: tagResult.isFinal };
}
