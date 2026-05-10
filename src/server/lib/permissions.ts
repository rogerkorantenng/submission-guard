import type { Context } from '@devvit/public-api';

export type ModUser = { permissions?: string[] } | null | undefined;

const MOD_GRANT = new Set(['mod', 'all']);

export function hasModPermission(user: ModUser): boolean {
  if (!user || !Array.isArray(user.permissions)) return false;
  return user.permissions.some((p) => MOD_GRANT.has(p));
}

export async function isCallerMod(context: Context): Promise<boolean> {
  const subreddit = await context.reddit.getCurrentSubreddit();
  const user = await context.reddit.getCurrentUser();
  if (!user || !subreddit) return false;
  const permissions = await user.getModPermissionsForSubreddit(subreddit.name);
  return hasModPermission({ permissions });
}
