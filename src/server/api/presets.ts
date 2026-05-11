import type { Context } from '@devvit/public-api';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';
import { getPreset, PRESETS, type Preset } from '../lib/presets';
import { saveGuardSettings } from '../lib/settings';

export async function presetsListHandler(
  context: Context,
): Promise<{ presets: Array<Pick<Preset, 'id' | 'label' | 'description'>> } | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  return {
    presets: PRESETS.map((p) => ({ id: p.id, label: p.label, description: p.description })),
  };
}

export async function presetApplyHandler(
  context: Context,
  payload: unknown,
): Promise<{ ok: true } | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  const body = (payload ?? {}) as { id?: unknown };
  if (typeof body.id !== 'string') return { error: 'id required' };
  const preset = getPreset(body.id);
  if (!preset) return { error: `unknown preset: ${body.id}` };
  try {
    await saveGuardSettings(context, me.subreddit, preset.settings);
    return { ok: true };
  } catch (err) {
    return { error: String(err) };
  }
}
