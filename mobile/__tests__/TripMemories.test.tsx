import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { TripMemories } from '../src/trips/TripMemories';
import { addTripPhotos, listTripPhotos, pickTripPhotos } from '../src/trips/tripPhotos';

jest.mock('../src/trips/tripPhotos', () => ({
  addTripPhotos: jest.fn(),
  listTripPhotos: jest.fn(),
  pickTripPhotos: jest.fn(),
}));

const pick = jest.mocked(pickTripPhotos);
const list = jest.mocked(listTripPhotos);
const add = jest.mocked(addTripPhotos);

beforeEach(() => {
  jest.resetAllMocks();
  list.mockReturnValue([]);
});

it('copies selected photos into the current trip and shows them when reopened', async () => {
  const photos = [{ uri: 'file:///cache/photo.jpg', width: 300, height: 400 }];
  pick.mockResolvedValue(photos);
  add.mockImplementation(async () => {
    list.mockReturnValue(['file:///documents/trip/photo.jpg']);
  });
  const props = { ownerId: 'owner', tripId: 'completed-trip', disabled: false, onBusy: jest.fn() };
  const view = await render(<TripMemories {...props} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
  await screen.findByLabelText('Trip photo 1');
  expect(add).toHaveBeenCalledWith('owner', 'completed-trip', photos);
  await view.unmount();
  await render(<TripMemories {...props} />);
  await screen.findByLabelText('Trip photo 1');
});
