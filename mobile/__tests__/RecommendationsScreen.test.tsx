import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { RecommendationsScreen } from '../src/components/recommendations/recommendationsScreen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('flips the existing postcard and opens its actual catalog place', async () => {
  const open = jest.fn();
  await render(<RecommendationsScreen onOpenPlace={open} />);
  await screen.findByLabelText('Read postcard for Jazz Alley by Maya');
  expect(screen.getAllByText(/Sample postcard/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Demo postcards/)).toBeNull();
  expect(screen.queryByText(/@maya/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Read postcard for Jazz Alley by Maya'));
  await screen.findByLabelText('Show photo for Jazz Alley by Maya');
  await fireEvent.press(screen.getByLabelText('See place: Jazz Alley, recommended by Maya'));
  expect(open).toHaveBeenCalledWith('p-jazz');
});

it('shows a feed failure and recovers through retry', async () => {
  const original = api.callApi;
  let fail = true;
  jest.spyOn(api, 'callApi').mockImplementation((name, request) => {
    if (name === 'getFeed' && fail) return Promise.reject(new Error('offline'));
    return original(name, request);
  });
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByText('Could not load postcards. Check your connection and try again.');
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry postcards' }));
  await screen.findByLabelText('See place: Jazz Alley, recommended by Maya');
});

it('explains an empty feed without inventing postcards', async () => {
  jest.spyOn(api, 'callApi').mockResolvedValue({ items: [] });
  await render(<RecommendationsScreen onOpenPlace={jest.fn()} />);
  await screen.findByText('No postcards for Seattle yet.');
  expect(screen.queryByText('See place ›')).toBeNull();
});
