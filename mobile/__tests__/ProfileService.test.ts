// Runs the real ProfileService and UserRepository against the in-memory
// Firestore, which mimics the profile rules in firestore.rules.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ensureProfile, getProfile, updateProfile } from '../src/services/ProfileService';
import { fake } from '../test-utils/fakeFirestore';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
jest.mock('../src/repositories/firestore', () => ({ db: {} }));

// The account's display name, which tests change. jest.mock can only refer to
// outside variables whose names start with "mock".
const mockAccount: { displayName: string | null } = { displayName: 'Banara' };
jest.mock('../src/auth/AuthService', () => {
  const { fake: f } = require('../test-utils/fakeFirestore');
  return {
    getCurrentUserId: () => f.uid,
    getCurrentUser: () =>
      f.uid ? { uid: f.uid, email: 'me@example.com', displayName: mockAccount.displayName } : null,
  };
});

beforeEach(() => {
  fake.reset();
  fake.uid = 'u-me';
  mockAccount.displayName = 'Banara';
});

describe('ensureProfile', () => {
  it('creates the profile with the requested name and never stores email', async () => {
    const result = await ensureProfile({ displayName: '  Bee  ' });

    expect(result).toEqual({
      profile: { id: 'u-me', name: 'Bee', bio: '', interests: [] },
      created: true,
    });
    const stored = fake.get('users/u-me');
    expect(stored).toMatchObject({ id: 'u-me', name: 'Bee', bio: '', interests: [] });
    expect(typeof stored?.createdAt).toBe('string');
    expect(JSON.stringify(stored)).not.toContain('me@example.com');
  });

  it("falls back to the account's name, then a default", async () => {
    await expect(ensureProfile({})).resolves.toMatchObject({ profile: { name: 'Banara' } });

    fake.reset();
    fake.uid = 'u-me';
    mockAccount.displayName = null;
    await expect(ensureProfile({})).resolves.toMatchObject({ profile: { name: 'Traveler' } });
  });

  it('leaves an existing profile unchanged', async () => {
    await ensureProfile({ displayName: 'First' });
    const before = fake.get('users/u-me');

    const again = await ensureProfile({ displayName: 'Second' });

    expect(again.created).toBe(false);
    expect(again.profile.name).toBe('First');
    expect(fake.get('users/u-me')).toEqual(before);
  });

  it('requires sign-in', async () => {
    fake.uid = null;
    await expect(ensureProfile({})).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

describe('getProfile', () => {
  beforeEach(() => {
    fake.seed('users/u-maya', {
      id: 'u-maya',
      name: 'Maya',
      bio: 'Loves live music.',
      interests: ['jazz'],
      createdAt: '2026-10-01T12:00:00Z',
    });
  });

  it('returns my profile when no userId is given', async () => {
    await ensureProfile({});
    await expect(getProfile({})).resolves.toEqual({
      profile: { id: 'u-me', name: 'Banara', bio: '', interests: [] },
    });
  });

  it('returns another user without private fields', async () => {
    const { profile } = await getProfile({ userId: 'u-maya' });
    expect(profile).toEqual({
      id: 'u-maya',
      name: 'Maya',
      bio: 'Loves live music.',
      interests: ['jazz'],
    });
  });

  it('says not-found for a missing profile', async () => {
    await expect(getProfile({ userId: 'nobody' })).rejects.toMatchObject({ code: 'not-found' });
    await expect(getProfile({})).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('updateProfile', () => {
  it('cleans and saves only the fields that were sent, keeping createdAt', async () => {
    await ensureProfile({});
    const createdAt = fake.get('users/u-me')?.createdAt;

    const { profile } = await updateProfile({
      bio: '  Exchange student  ',
      interests: [' Jazz ', 'jazz', '', 'coffee'],
    });

    expect(profile).toEqual({
      id: 'u-me',
      name: 'Banara',
      bio: 'Exchange student',
      interests: ['Jazz', 'coffee'],
    });
    expect(fake.get('users/u-me')).toEqual({ ...profile, createdAt });
  });

  it('rejects bad input without writing', async () => {
    await ensureProfile({});
    const before = fake.get('users/u-me');

    await expect(updateProfile({ name: '   ' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(updateProfile({ bio: 'x'.repeat(501) })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    const interests = Array.from({ length: 21 }, (_, i) => `interest ${i}`);
    await expect(updateProfile({ interests })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(fake.get('users/u-me')).toEqual(before);
  });

  it('says not-found if the profile was never created', async () => {
    await expect(updateProfile({ name: 'Bee' })).rejects.toMatchObject({ code: 'not-found' });
  });
});
