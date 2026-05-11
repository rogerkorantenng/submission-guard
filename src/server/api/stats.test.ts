import { describe, it, expect } from 'vitest';
import { __test } from './stats';
import type { EnforcementEvent } from '@shared/types';

const { aggregate } = __test;
const now = Date.now();
const HOUR = 3600_000;
const DAY = 86_400_000;

function ev(partial: Partial<EnforcementEvent> & Pick<EnforcementEvent, 'reason' | 'authorName' | 'ts'>): EnforcementEvent {
  return {
    id: `${partial.ts}-${partial.authorName}`,
    postId: 't3_dummy',
    title: 'sample',
    detail: 'sample detail',
    permalink: '',
    ...partial,
  };
}

describe('stats aggregate', () => {
  it('returns zeros on empty input', () => {
    const s = aggregate([]);
    expect(s.totalRemovals).toBe(0);
    expect(s.windows).toEqual({ last24h: 0, last7d: 0, last30d: 0 });
    expect(s.byReason['rate-limit']).toBe(0);
    expect(s.topAuthors).toEqual([]);
  });

  it('aggregates rolling window counts', () => {
    const events = [
      ev({ reason: 'rate-limit', authorName: 'alice', ts: now - HOUR }),
      ev({ reason: 'invalid-tags', authorName: 'bob', ts: now - 3 * DAY }),
      ev({ reason: 'invalid-tags', authorName: 'carol', ts: now - 20 * DAY }),
      ev({ reason: 'rate-limit', authorName: 'alice', ts: now - 40 * DAY }),
    ];
    const s = aggregate(events);
    expect(s.totalRemovals).toBe(4);
    expect(s.windows.last24h).toBe(1);
    expect(s.windows.last7d).toBe(2);
    expect(s.windows.last30d).toBe(3);
  });

  it('counts by reason', () => {
    const events = [
      ev({ reason: 'rate-limit', authorName: 'a', ts: now }),
      ev({ reason: 'rate-limit', authorName: 'b', ts: now }),
      ev({ reason: 'invalid-tags', authorName: 'c', ts: now }),
    ];
    const s = aggregate(events);
    expect(s.byReason['rate-limit']).toBe(2);
    expect(s.byReason['invalid-tags']).toBe(1);
    expect(s.byReason['code-block']).toBe(0);
  });

  it('returns top 5 authors descending', () => {
    const events: EnforcementEvent[] = [];
    for (let i = 0; i < 4; i++) events.push(ev({ reason: 'invalid-tags', authorName: 'alice', ts: now }));
    for (let i = 0; i < 2; i++) events.push(ev({ reason: 'invalid-tags', authorName: 'bob', ts: now }));
    events.push(ev({ reason: 'invalid-tags', authorName: 'carol', ts: now }));
    const s = aggregate(events);
    expect(s.topAuthors[0]).toEqual({ author: 'alice', count: 4 });
    expect(s.topAuthors[1]).toEqual({ author: 'bob', count: 2 });
    expect(s.topAuthors[2]).toEqual({ author: 'carol', count: 1 });
  });
});
