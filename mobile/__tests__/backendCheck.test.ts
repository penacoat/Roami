import { beforeEach, expect, it } from '@jest/globals';

import { resetFixtures } from '../src/api';
import { runBackendCheck } from '../src/dev/backendCheck';

beforeEach(() => {
  resetFixtures();
});

it('passes every step against the fixtures', async () => {
  const lines = await runBackendCheck();
  expect(lines.filter((l) => !l.ok)).toEqual([]);
  expect(lines[lines.length - 1].text).toBe('All steps passed.');
  expect(lines.some((l) => l.text.startsWith('stale edit: refused'))).toBe(true);
});
