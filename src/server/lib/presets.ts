import type { GuardSettings } from '@shared/types';
import { DEFAULTS } from './settings';

/**
 * Preset configurations for known long-form subreddits. Each preset is a
 * complete `GuardSettings` -- when a mod picks one in the panel, it
 * overwrites their current settings entirely.
 *
 * The defaults mirror what each sub actually moderates today (as of May 2026).
 * These are educated starting points; mods can tune from there.
 */

export interface Preset {
  id: string;
  label: string;
  description: string;
  settings: GuardSettings;
}

export const PRESETS: Preset[] = [
  {
    id: 'nosleep',
    label: 'r/nosleep (default)',
    description:
      'Matches the original nosleepautobot rules: 24h post rate, 350-word paragraph cap, NSFW token blocked, series auto-flair, full title-tag whitelist.',
    settings: { ...DEFAULTS },
  },
  {
    id: 'hfy',
    label: 'r/HFY (long-form sci-fi)',
    description:
      'Looser title-tag rules (HFY uses [OC], [Text], [Misc] tags), 12h rate limit, 500-word paragraph cap. Stricter on new accounts.',
    settings: {
      ...DEFAULTS,
      maxWordsPerParagraph: 500,
      rateLimitWindowSec: 12 * 3600,
      seriesFlairCssClass: 'series',
      customTitleTagPatterns: [
        '^oc$',
        '^text$',
        '^misc$',
        '^prompt$',
        '^discussion$',
        '^meta$',
        '^pi$',
      ],
      accountAgeRateLimitTiers: [
        { maxAgeDays: 14, windowMultiplier: 2 },
        { maxAgeDays: 60, windowMultiplier: 1 },
        { maxAgeDays: Number.MAX_SAFE_INTEGER, windowMultiplier: 0.5 },
      ],
    },
  },
  {
    id: 'writingprompts',
    label: 'r/WritingPrompts',
    description:
      'Permits [WP], [CW], [EU], [PI], [PM], [TT], [IP], [RF], [SP] prompt-tag conventions. 6h rate limit. No paragraph cap (prompts are short). No code-block rule.',
    settings: {
      ...DEFAULTS,
      enableLongParagraph: false,
      enableCodeBlock: false,
      rateLimitWindowSec: 6 * 3600,
      customTitleTagPatterns: [
        '^wp$', // Writing Prompt
        '^cw$', // Constrained Writing
        '^eu$', // Established Universe
        '^pi$', // Prompt Inspired
        '^pm$', // Prompt Me
        '^tt$', // Theme Thursday
        '^ip$', // Image Prompt
        '^rf$', // Reality Fiction
        '^sp$', // Simple Prompt
        '^sat$', // Satire
      ],
    },
  },
  {
    id: 'shortscarystories',
    label: 'r/shortscarystories',
    description: 'Tight word caps (200-word paragraphs), 48h rate limit (one story per author per 48h).',
    settings: {
      ...DEFAULTS,
      maxWordsPerParagraph: 200,
      rateLimitWindowSec: 48 * 3600,
    },
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
