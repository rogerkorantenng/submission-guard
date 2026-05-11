import type { Context } from '@devvit/public-api';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';
import { evaluateSubmission, type EvaluateResult } from '../lib/evaluate';
import { getGuardSettings } from '../lib/settings';

export interface PreviewInput {
  title: string;
  body: string;
}

/**
 * "Would this post be removed?" — pure dry-run of the evaluator against the
 * current sub's settings. Lets mods test rule changes without submitting
 * real posts. AutoMod can't do this — you have to edit the wiki and pray.
 */
export async function previewHandler(
  context: Context,
  payload: unknown,
): Promise<EvaluateResult | { error: string }> {
  if (!(await isCallerMod(context))) return { error: 'forbidden' };
  const me = await whoami(context);
  const body = (payload ?? {}) as Partial<PreviewInput>;
  if (typeof body.title !== 'string') return { error: 'title required' };
  if (typeof body.body !== 'string') return { error: 'body required' };

  const settings = await getGuardSettings(context, me.subreddit);
  return evaluateSubmission({
    postId: 'preview_only',
    authorName: me.modName ?? 'preview',
    title: body.title,
    body: body.body,
    createdAtMs: Date.now(),
    flairCssClass: null,
    priorActivity: null,
    accountAgeDays: 365, // assume tenured account for preview
    settings,
  });
}
