import React from 'react';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as api from '../src/api/ApiClient';
import { resetFixtures } from '../src/api';
import { SavedPlacesScreen } from '../src/screens/SavedPlacesScreen';
import { notifySavedPlacesChanged } from '../src/hooks/useSavedPlacesChanges';

jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.restoreAllMocks();
  resetFixtures();
});

it('pulls new saved places and their itinerary locations from an initially empty list', async () => {
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByText('Save a place in Explore to find it here.');
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  const { trip } = await api.callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await api.callApi('addStop', {
    tripId: trip.trip.id,
    expectedRevision: trip.trip.revision,
    placeId: 'p-jazz',
    day: 1,
    visitMinutes: 60,
  });
  await fireEvent(screen.getByTestId('saved-places-list'), 'refresh');
  await screen.findByLabelText('Open saved place: Jazz Alley');
  await screen.findByText('Scheduled in Seattle (trip starts Nov 23, 2026) · Day 1 · Nov 23, 2026');
});

it('keeps saved recommendations attached when the place is added to an itinerary', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
  const { trip } = await api.callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-23',
    endDate: '2026-11-24',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Add Jazz Alley to an itinerary' }),
  );
  await fireEvent.press(await screen.findByRole('button', { name: /Seattle/ }));
  await screen.findByText('Choose a day', {}, { timeout: 3000 });
  await fireEvent.press(screen.getByRole('button', { name: 'Add place' }));
  await screen.findByText('Added to Seattle · Day 1');
  expect(
    (await api.callApi('getTrip', { tripId: trip.trip.id })).trip.stops[0].recommendationIds,
  ).toEqual(['r1']);
});

it('loads saved places through the API, opens details, and removes the save', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
  const open = jest.fn();
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={open} />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' }),
  );
  expect(open).toHaveBeenCalledWith('p-jazz');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Save a place in Explore to find it here.');
  expect((await api.callApi('listSavedPlaces', {})).saved).toHaveLength(0);
});

it('refreshes when returning after a save on another screen', async () => {
  const props = { onExplore: jest.fn(), onOpenPlace: jest.fn() };
  const view = await render(<SavedPlacesScreen {...props} refreshKey={1} />);
  await screen.findByText('Save a place in Explore to find it here.');
  await api.callApi('savePlace', { placeId: 'p-pike' });
  await view.rerender(<SavedPlacesScreen {...props} refreshKey={2} />);
  await screen.findByRole('button', { name: 'Open saved place: Pike Place Market' });
});

it('keeps a place when unsave fails, then lets the user retry', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Unsave Jazz Alley' });
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Could not unsave this place. Please try again.');
  expect(screen.getByRole('button', { name: 'Open saved place: Jazz Alley' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Save a place in Explore to find it here.');
});

it('refreshes when a save finishes after the user has already opened Saved', async () => {
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByText('Save a place in Explore to find it here.');
  await act(async () => {
    await api.callApi('savePlace', { placeId: 'p-jazz' });
    notifySavedPlacesChanged('explore');
  });
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
});

it('blocks repeated unsave taps while the write is pending', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Unsave Jazz Alley' });
  let finish: (value: { removed: true }) => void = () => {};
  const response = new Promise<{ removed: true }>((resolve) => {
    finish = resolve;
  });
  const request = jest.spyOn(api, 'callApi').mockReturnValueOnce(response);
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  expect(screen.getByRole('button', { name: 'Unsave Jazz Alley' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Jazz Alley' }));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ removed: true });
  });
  await screen.findByText('Save a place in Explore to find it here.');
});

it('distinguishes failed loading from an empty list and recovers', async () => {
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  const explore = jest.fn();
  await render(<SavedPlacesScreen refreshKey={1} onExplore={explore} onOpenPlace={jest.fn()} />);
  await screen.findByText('Could not load saved places. Please try again.');
  expect(screen.queryByText('Save a place in Explore to find it here.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry saved places' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Explore places' }));
  expect(explore).toHaveBeenCalledTimes(1);
});

it('shows the trip and day for a scheduled saved place', async () => {
  const { trip } = await api.callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await api.callApi('addStop', {
    tripId: trip.trip.id,
    expectedRevision: trip.trip.revision,
    placeId: 'p-jazz',
    day: 2,
    visitMinutes: 60,
  });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByText('Scheduled in Seattle (trip starts Nov 10, 2026) · Day 2 · Nov 11, 2026');
});

async function openSaved() {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Add note to Jazz Alley' });
}

it('adds a private note to a saved place', async () => {
  await openSaved();
  await fireEvent.press(screen.getByRole('button', { name: 'Add note to Jazz Alley' }));
  await fireEvent.changeText(screen.getByLabelText('Note for Jazz Alley'), '  Book the 8pm show  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save note for Jazz Alley' }));
  await screen.findByText('Book the 8pm show');
  expect(screen.getByText('Your private note')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Edit note for Jazz Alley' })).toBeTruthy();
  const { saved } = await api.callApi('listSavedPlaces', {});
  expect(saved[0]?.personalNote).toBe('Book the 8pm show');
});

it('edits a note and clears it by saving an empty note', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await api.callApi('updateSavedNote', { placeId: 'p-jazz', personalNote: 'Old note' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByText('Old note');
  await fireEvent.press(screen.getByRole('button', { name: 'Edit note for Jazz Alley' }));
  expect(screen.getByLabelText('Note for Jazz Alley').props.value).toBe('Old note');
  await fireEvent.changeText(screen.getByLabelText('Note for Jazz Alley'), 'New note');
  await fireEvent.press(screen.getByRole('button', { name: 'Save note for Jazz Alley' }));
  await screen.findByText('New note');

  await fireEvent.press(screen.getByRole('button', { name: 'Edit note for Jazz Alley' }));
  await fireEvent.changeText(screen.getByLabelText('Note for Jazz Alley'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Save note for Jazz Alley' }));
  await screen.findByRole('button', { name: 'Add note to Jazz Alley' });
  expect(screen.queryByText('Your private note')).toBeNull();
  expect((await api.callApi('listSavedPlaces', {})).saved[0]?.personalNote).toBe('');
});

it('discards changes when the user cancels editing a note', async () => {
  await openSaved();
  await fireEvent.press(screen.getByRole('button', { name: 'Add note to Jazz Alley' }));
  await fireEvent.changeText(screen.getByLabelText('Note for Jazz Alley'), 'Never mind');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel note for Jazz Alley' }));
  expect(screen.queryByText('Never mind')).toBeNull();
  expect((await api.callApi('listSavedPlaces', {})).saved[0]?.personalNote).toBe('');
});

it('keeps the draft and shows an error when saving a note fails', async () => {
  await openSaved();
  await fireEvent.press(screen.getByRole('button', { name: 'Add note to Jazz Alley' }));
  await fireEvent.changeText(screen.getByLabelText('Note for Jazz Alley'), 'Try again later');
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Save note for Jazz Alley' }));
  await screen.findByText('Could not save your note. Please try again.');
  expect(screen.getByLabelText('Note for Jazz Alley').props.value).toBe('Try again later');
  await fireEvent.press(screen.getByRole('button', { name: 'Save note for Jazz Alley' }));
  await screen.findByText('Try again later');
  expect(screen.queryByText('Could not save your note. Please try again.')).toBeNull();
});

it('undoes an unsave and brings back the note and recommendation sources', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
  await api.callApi('updateSavedNote', { placeId: 'p-jazz', personalNote: 'Book ahead' });
  const before = (await api.callApi('listSavedPlaces', {})).saved[0]!;
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Jazz Alley removed.');
  expect((await api.callApi('listSavedPlaces', {})).saved).toHaveLength(0);

  await fireEvent.press(screen.getByRole('button', { name: 'Undo removing Jazz Alley' }));
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
  expect(screen.getByText('Book ahead')).toBeTruthy();
  expect(screen.queryByText('Jazz Alley removed.')).toBeNull();
  const after = (await api.callApi('listSavedPlaces', {})).saved[0]!;
  expect(after.personalNote).toBe('Book ahead');
  expect(after.createdAt).toBe(before.createdAt);
  expect(after.recommendations.map((r) => r.id)).toEqual(before.recommendations.map((r) => r.id));
});

it('keeps Undo available when restoring fails, and works on retry', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Jazz Alley removed.');
  jest.spyOn(api, 'callApi').mockRejectedValueOnce(new Error('offline'));
  await fireEvent.press(screen.getByRole('button', { name: 'Undo removing Jazz Alley' }));
  await screen.findByText('Could not undo. Please try again.');
  await fireEvent.press(screen.getByRole('button', { name: 'Undo removing Jazz Alley' }));
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
});

it('drops the Undo prompt when another place is unsaved', async () => {
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await api.callApi('savePlace', { placeId: 'p-pike' });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Unsave Jazz Alley' }));
  await screen.findByText('Jazz Alley removed.');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave Pike Place Market' }));
  await screen.findByText('Pike Place Market removed.');
  expect(screen.queryByText('Jazz Alley removed.')).toBeNull();
});

it('does not show scheduling from an archived trip', async () => {
  const { trip } = await api.callApi('createTrip', {
    city: 'Seattle',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    dailyWindow: { start: '09:00', end: '21:00' },
  });
  await api.callApi('savePlace', { placeId: 'p-jazz' });
  await api.callApi('addStop', {
    tripId: trip.trip.id,
    expectedRevision: trip.trip.revision,
    placeId: 'p-jazz',
    day: 2,
    visitMinutes: 60,
  });
  await api.callApi('setTripArchived', { tripId: trip.trip.id, archived: true });
  await render(<SavedPlacesScreen refreshKey={1} onExplore={jest.fn()} onOpenPlace={jest.fn()} />);
  await screen.findByRole('button', { name: 'Open saved place: Jazz Alley' });
  expect(screen.queryByText(/^Scheduled in Seattle/)).toBeNull();
});
