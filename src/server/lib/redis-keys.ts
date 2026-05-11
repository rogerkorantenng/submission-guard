function ensure(name: string, value: string): string {
  if (!value) throw new Error(`${name} required`);
  return value;
}

/**
 * Redis key namespaces. Mirrors the original `submission.<id>` and
 * `activity.<author>` shape but per-sub scoped (Devvit doesn't have global
 * cross-sub Redis like the original's single-sub bot did).
 */
export const keys = {
  submission: (sub: string, postId: string) =>
    `submission:${ensure('sub', sub)}:${ensure('postId', postId).toLowerCase()}`,
  activity: (sub: string, author: string) =>
    `activity:${ensure('sub', sub)}:${ensure('author', author).toLowerCase()}`,
  /**
   * Sorted set, score=ts, member=JSON of `EnforcementEvent`. Read by the mod
   * panel for the recent-actions rail.
   */
  enforcementFeed: (sub: string) => `enforcement_feed:${ensure('sub', sub)}`,
  /** Per-sub `GuardSettings` JSON. */
  settings: (sub: string) => `settings:${ensure('sub', sub)}`,
  /**
   * Sorted set of violation timestamps for a single author in a sub.
   * Member = ts, score = ts -- we want to range by time. Trimmed on each
   * write to keep only the rolling window.
   */
  violations: (sub: string, author: string) =>
    `violations:${ensure('sub', sub)}:${ensure('author', author).toLowerCase()}`,
  /**
   * Sorted set of recent same-rule hits across all authors. Used by raid
   * detection to count distinct authors in a rolling window. Member is the
   * author name, score is the violation ts. zRangeByScore + uniq gives us
   * the distinct-author count cheaply.
   */
  ruleHits: (sub: string, reason: string) =>
    `rule_hits:${ensure('sub', sub)}:${ensure('reason', reason)}`,
  /**
   * Idempotency guard for raid alerts. When we modmail mods about a raid,
   * write a marker key so we don't alert again for the same window. Key
   * carries a TTL equal to the raid window.
   */
  raidAlertSent: (sub: string, reason: string) =>
    `raid_alert_sent:${ensure('sub', sub)}:${ensure('reason', reason)}`,
  /**
   * Hash storing reapproval metadata. Field = postId, value = JSON with
   * {reapprovedBy, reapprovedAt}. Separate from enforcement feed for simpler updates.
   */
  reapprovals: (sub: string) => `reapprovals:${ensure('sub', sub)}`,
};

export const TTL = {
  /** Submission cache TTL in seconds. Matches original (post_timelimit * 2). */
  submissionSec: 86_400 * 2,
  /** Default enforcement-feed cap (read-side trim). */
  feedCapMembers: 200,
};
