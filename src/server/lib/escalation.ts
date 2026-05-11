import type { RemovalReason } from '@shared/types';

/**
 * Pure decision function for cumulative-violation escalation. Given a count
 * of prior violations within the configured window, decide what to do with
 * the NEXT violation:
 *
 *  - count < warnThreshold       -> 'warn' (no removal, soft comment)
 *  - count < removeThreshold     -> 'remove' (normal remove + sticky comment)
 *  - count >= removeThreshold    -> 'remove-and-alert' (remove + modmail mods)
 *
 * The "count" passed in should be the number of PRIOR violations in the
 * window (excluding the current one). The decision is what to do for the
 * incoming violation.
 */
export type EscalationAction = 'warn' | 'remove' | 'remove-and-alert';

export interface EscalationConfig {
  warnThreshold: number;
  removeThreshold: number;
}

export function decideEscalation(
  priorCount: number,
  config: EscalationConfig,
): EscalationAction {
  if (priorCount < config.warnThreshold) return 'warn';
  if (priorCount < config.removeThreshold) return 'remove';
  return 'remove-and-alert';
}

export interface RaidConfig {
  minDistinctAuthors: number;
}

/**
 * Should we modmail mods about a possible raid? True when the count of
 * distinct authors who hit `reason` within the recent window meets or
 * exceeds the configured floor.
 */
export function decideRaidAlert(
  distinctAuthorCount: number,
  config: RaidConfig,
  _reason: RemovalReason,
): boolean {
  return distinctAuthorCount >= config.minDistinctAuthors;
}
