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
};

export const TTL = {
  /** Submission cache TTL in seconds. Matches original (post_timelimit * 2). */
  submissionSec: 86_400 * 2,
  /** Default enforcement-feed cap (read-side trim). */
  feedCapMembers: 200,
};
