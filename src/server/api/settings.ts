import type { Context } from '@devvit/public-api';
import type { GuardSettings } from '@shared/types';
import { getGuardSettings, saveGuardSettings } from '../lib/settings';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';

export async function settingsGetHandler(
  context: Context,
): Promise<GuardSettings | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  try {
    return await getGuardSettings(context, me.subreddit);
  } catch (err) {
    return { error: String(err) };
  }
}

export async function settingsSaveHandler(
  context: Context,
  payload: unknown,
): Promise<GuardSettings | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  if (!payload || typeof payload !== 'object') return { error: 'payload required' };
  try {
    return await saveGuardSettings(context, me.subreddit, payload as Partial<GuardSettings>);
  } catch (err) {
    return { error: String(err) };
  }
}
