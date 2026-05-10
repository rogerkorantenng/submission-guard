/**
 * Reasons a post can be removed by Submission Guard. Mirrors the rule names
 * the original `nosleepautobot` enforces, plus a generic catch-all.
 */
export const REMOVAL_REASONS = [
  'invalid-tags',
  'nsfw-in-title',
  'long-paragraph',
  'code-block',
  'rate-limit',
] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

export function isRemovalReason(v: unknown): v is RemovalReason {
  return typeof v === 'string' && (REMOVAL_REASONS as readonly string[]).includes(v);
}

/**
 * Per-sub Submission Guard settings. All knobs the original `autobot.env.sample`
 * exposed, plus a few new ones the port exposes per-install via Devvit settings.
 */
export interface GuardSettings {
  enableTitleTags: boolean;
  enableNsfwTitle: boolean;
  enableLongParagraph: boolean;
  enableCodeBlock: boolean;
  enableRateLimit: boolean;
  enableSeriesAutoFlair: boolean;
  /** Custom regex patterns appended to the built-in title tag whitelist. */
  customTitleTagPatterns: string[];
  /** Word-count cap per paragraph. Default 350 (matches r/nosleep). */
  maxWordsPerParagraph: number;
  /** Rate limit window in seconds. Default 86400 (24h). */
  rateLimitWindowSec: number;
  /** CSS class string of the Series flair template in the sub. */
  seriesFlairCssClass: string;
  /** If true, also send the UpdateMeBot reminder comment + DM author. */
  enableSeriesReminderComment: boolean;
}

/**
 * One enforcement event per removed (or warned) submission. Persisted to a
 * per-sub Redis sorted set and shown in the mod panel.
 */
export interface EnforcementEvent {
  id: string; // `${ts}-${postId}`
  postId: string;
  authorName: string;
  title: string;
  reason: RemovalReason;
  detail: string; // human-readable explainer (e.g. "352 words in paragraph 3")
  ts: number;
  permalink: string;
}

/**
 * Cached per-author activity row for rate-limit enforcement. Mirrors the
 * original Activity model (`autobot/models/models.py:Activity`).
 */
export interface AuthorActivity {
  author: string;
  lastPostId: string;
  /** Unix epoch milliseconds (NOT seconds — original used seconds). */
  lastPostTimeMs: number;
}

/**
 * Cached per-submission row used to:
 *  - dedupe when the trigger fires multiple times for the same post
 *  - support retroactive series flair detection
 *  - drive the mod panel's recent-actions list
 *
 * Mirrors the original Submission model (`autobot/models/models.py:Submission`).
 */
export interface CachedSubmission {
  id: string;
  author: string;
  submittedMs: number;
  series: boolean;
  sentSeriesPm: boolean;
}
