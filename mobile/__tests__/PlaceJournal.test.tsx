import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';
import { callApi, resetFixtures } from '../src/api';
import { PlaceJournal, VisitPlace } from '../src/components/PlaceJournal';

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('records visits, reorders a category, and shares only the selected ranked place', async () => {
  const { place } = await callApi('getPlace', { placeId: 'p-sam' });
  await render(<VisitPlace place={place} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Mark visited' }));
  await fireEvent.changeText(screen.getByLabelText('Visit date'), '2026-11-10');
  await fireEvent.press(screen.getByRole('button', { name: 'Save visit' }));
  await screen.findByText('Visit recorded for Nov 10, 2026.');
  await callApi('markVisited', { placeId: 'p-chihuly', visitDate: '2026-11-10' });
  await render(<PlaceJournal />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Rank Seattle Art Museum' }));
  await screen.findByText('1. Seattle Art Museum');
  await fireEvent.press(screen.getByRole('button', { name: 'Rank Chihuly Garden and Glass' }));
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Move Chihuly Garden and Glass up in ranking' }),
  );
  await screen.findByText('1. Chihuly Garden and Glass');
  await fireEvent.press(screen.getByRole('button', { name: 'Share ranking' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Seattle Art Museum' }));
  const sharing = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  await fireEvent.press(screen.getByRole('button', { name: 'Open share sheet' }));
  expect(sharing).toHaveBeenCalledWith({
    title: 'My museum ranking',
    message: 'My museum ranking\n2. Seattle Art Museum',
  });
});
