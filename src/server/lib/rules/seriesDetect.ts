/**
 * Series detection helper. The primary path is via `analyzeTitleTags()` (in
 * `titleTags.ts`) which sets `isSeries` and `isFinal`. This module exposes a
 * fallback used by the trigger handler when title tags didn't trigger series
 * but a moderator already applied the series flair manually.
 */

export function isSeriesByFlair(args: {
  flairCssClass: string | undefined | null;
  configuredSeriesClass: string;
}): boolean {
  if (!args.flairCssClass) return false;
  return args.flairCssClass.toLowerCase() === args.configuredSeriesClass.toLowerCase();
}
