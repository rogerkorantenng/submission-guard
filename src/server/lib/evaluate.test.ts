import { describe, it, expect } from 'vitest';
import { evaluateSubmission } from './evaluate';
import { DEFAULTS } from './settings';

const baseInput = {
  postId: 't3_x',
  authorName: 'alice',
  title: 'My story [Part 2]',
  body: 'A normal paragraph.',
  createdAtMs: 1_700_000_000_000,
  flairCssClass: null,
  priorActivity: null,
  settings: DEFAULTS,
} as const;

describe('evaluateSubmission - end-to-end rule orchestration', () => {
  it('accepts a clean series post', () => {
    const r = evaluateSubmission(baseInput);
    expect(r.type).toBe('accept');
    if (r.type === 'accept') {
      expect(r.isSeries).toBe(true);
      expect(r.isFinal).toBe(false);
    }
  });

  it('removes for invalid tags first', () => {
    const r = evaluateSubmission({ ...baseInput, title: 'X [made-up-tag]' });
    expect(r.type).toBe('remove');
    if (r.type === 'remove') expect(r.reason).toBe('invalid-tags');
  });

  it('removes for NSFW token in title (when not inside an invalid tag)', () => {
    // Free-floating NSFW (not in brackets) -> title-tag check passes,
    // NSFW check fires.
    const r = evaluateSubmission({ ...baseInput, title: 'My NSFW story' });
    expect(r.type).toBe('remove');
    if (r.type === 'remove') {
      expect(r.reason).toBe('nsfw-in-title');
      expect(r.allowReapproval).toBe(false);
    }
  });

  it('removes for long paragraph (351 words at default cap)', () => {
    const big = 'word '.repeat(351).trim();
    const r = evaluateSubmission({ ...baseInput, body: big });
    expect(r.type).toBe('remove');
    if (r.type === 'remove') expect(r.reason).toBe('long-paragraph');
  });

  it('removes for code block (4-space indent)', () => {
    const r = evaluateSubmission({ ...baseInput, body: '    code line' });
    expect(r.type).toBe('remove');
    if (r.type === 'remove') expect(r.reason).toBe('code-block');
  });

  it('removes for rate limit when prior activity is recent', () => {
    const r = evaluateSubmission({
      ...baseInput,
      priorActivity: {
        author: 'alice',
        lastPostId: 't3_w',
        lastPostTimeMs: baseInput.createdAtMs - 3600_000,
      },
    });
    expect(r.type).toBe('remove');
    if (r.type === 'remove') {
      expect(r.reason).toBe('rate-limit');
      expect(r.waitPhrase).toContain('hour');
    }
  });

  it('respects per-rule disable toggle', () => {
    const r = evaluateSubmission({
      ...baseInput,
      title: 'X [made-up-tag]',
      settings: { ...DEFAULTS, enableTitleTags: false },
    });
    expect(r.type).toBe('accept');
  });

  it('honors a custom title-tag pattern from settings', () => {
    const r = evaluateSubmission({
      ...baseInput,
      title: 'X [HORROR-OC]',
      settings: { ...DEFAULTS, customTitleTagPatterns: ['^horror-oc$'] },
    });
    expect(r.type).toBe('accept');
  });
});
