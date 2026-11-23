import { describe, expect, it } from '@jest/globals';

import { decodeCursor, encodeCursor, pageAfter } from '../src/logic/feedPaging';

const item = (id: string, createdAt: string) => ({ id, createdAt });
const items = [
  item('a', '2026-10-01T00:00:00Z'),
  item('b', '2026-10-03T00:00:00Z'),
  item('c', '2026-10-02T00:00:00Z'),
  item('d', '2026-10-02T00:00:00Z'),
];

describe('pageAfter', () => {
  it('returns the newest first, ties by ID, with a cursor when more remain', () => {
    const { page, nextCursor } = pageAfter(items, null, 2);
    expect(page.map((i) => i.id)).toEqual(['b', 'c']);
    expect(nextCursor).toBe(encodeCursor(item('c', '2026-10-02T00:00:00Z')));
  });

  it('continues after the cursor and ends with no cursor', () => {
    const first = pageAfter(items, undefined, 2);
    const second = pageAfter(items, first.nextCursor, 2);
    expect(second.page.map((i) => i.id)).toEqual(['d', 'a']);
    expect(second.nextCursor).toBeNull();
  });

  it('has no cursor when the last page is exactly full', () => {
    expect(pageAfter(items, null, 4).nextCursor).toBeNull();
  });

  it('returns nothing for an empty list, and for a cursor past the end', () => {
    expect(pageAfter([], null, 5)).toEqual({ page: [], nextCursor: null });
    expect(pageAfter(items, encodeCursor(item('zzz', '2000-01-01T00:00:00Z')), 5).page).toEqual([]);
  });

  it('still works when the item the cursor points to is gone', () => {
    const cursor = encodeCursor(items[2]!);
    const without = items.filter((i) => i.id !== 'c');
    expect(pageAfter(without, cursor, 5).page.map((i) => i.id)).toEqual(['d', 'a']);
  });

  it('throws on a malformed cursor', () => {
    expect(() => pageAfter(items, 'nonsense', 2)).toThrow();
  });
});

describe('decodeCursor', () => {
  it('round-trips and rejects bad input', () => {
    const cursor = encodeCursor(item('x|y', '2026-10-01T00:00:00Z'));
    expect(decodeCursor(cursor)).toEqual(item('x|y', '2026-10-01T00:00:00Z'));
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('|id')).toBeNull();
    expect(decodeCursor('date|')).toBeNull();
  });
});
