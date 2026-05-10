import type { Context } from '@devvit/public-api';
import { hasModPermission } from '../lib/permissions';

export interface WhoAmI {
  isMod: boolean;
  modName: string | null;
  modId: string | null;
  subreddit: string;
}

export async function whoami(context: Context): Promise<WhoAmI> {
  const subreddit = await context.reddit.getCurrentSubreddit();
  const user = await context.reddit.getCurrentUser();
  if (!user || !subreddit) {
    return { isMod: false, modName: null, modId: null, subreddit: subreddit?.name ?? '' };
  }
  const permissions = await user.getModPermissionsForSubreddit(subreddit.name);
  const isMod = hasModPermission({ permissions });
  return {
    isMod,
    modName: isMod ? user.username : null,
    modId: isMod ? user.id : null,
    subreddit: subreddit.name,
  };
}
