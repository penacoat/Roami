/** Paging for the postcard feed. Pure, no Firebase. Newest first; ties break by ID. */

export interface Pageable {
  id: string;
  createdAt: string;
}

export interface FeedPage<T> {
  page: T[];
  /** Pass back to get the following page. Null when this page is the last. */
  nextCursor: string | null;
}

function newestFirst(a: Pageable, b: Pageable): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

/** A cursor remembers the last item shown, so new postcards arriving later don't shift the pages. */
export function encodeCursor(item: Pageable): string {
  return `${item.createdAt}|${item.id}`;
}

export function decodeCursor(cursor: string): Pageable | null {
  const split = cursor.indexOf('|');
  if (split <= 0 || split === cursor.length - 1) return null;
  return { createdAt: cursor.slice(0, split), id: cursor.slice(split + 1) };
}

/**
 * The next `limit` items after `cursor` (or the first `limit` when there is no
 * cursor). A cursor that no longer matches an item still works: it is a position
 * in the order, not a lookup. Throws if the cursor is malformed.
 */
export function pageAfter<T extends Pageable>(
  items: readonly T[],
  cursor: string | null | undefined,
  limit: number,
): FeedPage<T> {
  const sorted = [...items].sort(newestFirst);
  let rest = sorted;
  if (cursor !== null && cursor !== undefined) {
    const after = decodeCursor(cursor);
    if (!after) throw new Error('Malformed feed cursor.');
    rest = sorted.filter((item) => newestFirst(after, item) < 0);
  }
  const page = rest.slice(0, limit);
  const last = page[page.length - 1];
  return { page, nextCursor: last && rest.length > page.length ? encodeCursor(last) : null };
}
