import type { Context } from '@devvit/public-api';
import type { GuardSettings } from '@shared/types';
import { isCallerMod } from '../lib/permissions';
import { whoami } from './whoami';
import { getGuardSettings } from '../lib/settings';
import { readEnforcementFeed } from './enforcement';
import { evaluateSubmission } from '../lib/evaluate';

export interface SimulatorInput {
  /**
   * Modified settings to test. Only the fields provided will be overridden;
   * all other settings come from the current sub configuration.
   */
  settingsOverride: Partial<GuardSettings>;
}

export interface SimulationResult {
  totalEvents: number;
  currentRemovals: number;
  simulatedRemovals: number;
  wouldAccept: number;
  wouldRemove: number;
  delta: number;
}

/**
 * A/B test simulator: replays recent enforcement events against modified
 * settings and reports what would have changed. Evidence-based policy tuning.
 */
export async function simulatorHandler(
  context: Context,
  payload: unknown,
): Promise<SimulationResult | { error: string }> {
  if (!(await isCallerMod(context))) {
    console.log('[simulator] Forbidden: caller is not a mod');
    return { error: 'forbidden' };
  }

  const me = await whoami(context);
  const body = (payload ?? {}) as Partial<SimulatorInput>;

  if (!body.settingsOverride || typeof body.settingsOverride !== 'object') {
    console.log('[simulator] Bad request: missing settingsOverride');
    return { error: 'settingsOverride required' };
  }

  console.log(`[simulator] Running simulation for ${me.subreddit}`);

  try {
    // Get current settings
    const currentSettings = await getGuardSettings(context, me.subreddit);

    // Merge override
    const simulatedSettings: GuardSettings = {
      ...currentSettings,
      ...body.settingsOverride,
    };

    // Fetch recent enforcement events (last 30 days worth, up to 200)
    const events = await readEnforcementFeed(context, me.subreddit, 200);

    console.log(`[simulator] Testing ${events.length} events against modified settings`);

    let currentRemovals = events.length; // All events are removals
    let simulatedRemovals = 0;

    // Re-evaluate each event with simulated settings
    for (const ev of events) {
      const result = await evaluateSubmission({
        postId: ev.postId,
        authorName: ev.authorName,
        title: ev.title,
        body: '', // We don't store body, use empty string
        createdAtMs: ev.ts,
        flairCssClass: null,
        priorActivity: null,
        accountAgeDays: 365, // Assume tenured for simulation
        settings: simulatedSettings,
      });

      if (result.type === 'remove') {
        simulatedRemovals++;
      }
    }

    const wouldAccept = currentRemovals - simulatedRemovals;
    const wouldRemove = simulatedRemovals - currentRemovals;
    const delta = simulatedRemovals - currentRemovals;

    console.log(`[simulator] Results: ${currentRemovals} current, ${simulatedRemovals} simulated, delta ${delta}`);

    return {
      totalEvents: events.length,
      currentRemovals,
      simulatedRemovals,
      wouldAccept: Math.max(0, wouldAccept),
      wouldRemove: Math.max(0, wouldRemove),
      delta,
    };
  } catch (err) {
    console.error('[simulator] Error:', err);
    return { error: String(err) };
  }
}
