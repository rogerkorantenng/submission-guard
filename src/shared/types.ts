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
 * exposed, plus several new ones the port exposes per-install via Devvit
 * settings -- specifically the stateful pieces AutoModerator cannot do.
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
  /** Default rate limit window in seconds. Default 86400 (24h). */
  rateLimitWindowSec: number;
  /**
   * Account-age-aware rate limits. AutoMod cannot read author account age, so
   * this is one of the headline differentiators of the port. Each tier maps
   * an account-age threshold (days) to a multiplier on `rateLimitWindowSec`.
   * Sorted descending by `maxAgeDays`: the first row whose threshold the
   * author's account age is BELOW or EQUAL to wins.
   *
   * Example default policy:
   *   accounts <= 7 days old  -> 2x the base window (48h cooldown)
   *   accounts <= 30 days old -> 1x (same 24h)
   *   else                    -> 0.5x (12h, "trusted poster")
   */
  accountAgeRateLimitTiers: Array<{ maxAgeDays: number; windowMultiplier: number }>;
  /** CSS class string of the Series flair template in the sub. */
  seriesFlairCssClass: string;
  /** If true, also send the UpdateMeBot reminder comment + DM author. */
  enableSeriesReminderComment: boolean;
  /**
   * Cumulative-violation escalation. AutoMod cannot count violations across
   * time; we keep a per-author counter in Redis. When an author hits a rule
   * violation, the trigger uses these thresholds to decide what to do:
   *  - count <= warnThreshold: log + warn comment, no removal
   *  - count <= removeThreshold: standard remove + sticky comment
   *  - count >  removeThreshold: remove + modmail mods
   * `windowSec` is the rolling-window over which violations are counted.
   */
  enableEscalation: boolean;
  escalation: {
    warnThreshold: number;
    removeThreshold: number;
    windowSec: number;
  };
  /**
   * Raid detection. If N distinct authors hit the same rule within `windowSec`
   * seconds, modmail the mod team with a "possible raid" alert. AutoMod
   * cannot do this aggregation.
   */
  enableRaidDetection: boolean;
  raid: {
    minDistinctAuthors: number;
    windowSec: number;
  };
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
