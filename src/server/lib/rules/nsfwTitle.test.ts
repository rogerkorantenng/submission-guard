import { describe, it, expect } from 'vitest';
import { containsNsfwTitle } from './nsfwTitle';

describe('containsNsfwTitle - parity with nosleepautobot tests', () => {
  it('flags bracket-tagged NSFW', () => {
    expect(containsNsfwTitle('Story [NSFW]')).toBe(true);
  });

  it('flags exclamation-bounded NSFW', () => {
    expect(containsNsfwTitle('!NSFW! cool story')).toBe(true);
  });

  it('flags trailing-question NSFW', () => {
    expect(containsNsfwTitle('Is this post NSFW?')).toBe(true);
  });

  it('does NOT flag underscore-glued nsfw (matches original behavior)', () => {
    expect(containsNsfwTitle('nsfw_title_in_bars')).toBe(false);
  });

  it('case insensitive', () => {
    expect(containsNsfwTitle('story [nSfW]')).toBe(true);
  });

  it('ignores titles without nsfw token', () => {
    expect(containsNsfwTitle('A perfectly normal scary tale')).toBe(false);
  });
});
