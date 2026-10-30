import React from 'react';
import { useState } from 'react';
import { expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { TripCalendar } from '../src/trips/TripCalendar';
import { dateKey } from '../src/trips/tripDraft';

function Calendar() {
  const [range, setRange] = useState(['', '']);
  return <>
    <TripCalendar startDate={range[0]} endDate={range[1]} onChange={(start, end) => setRange([start, end])} />
    <Text testID="range">{range.join(' / ')}</Text>
  </>;
}

it('selects a range across months and starts a new range on the next tap', async () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 2);
  await render(<Calendar />);
  await fireEvent.press(screen.getByRole('button', { name: start.toLocaleDateString('en-US', { dateStyle: 'full' }) }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
  await fireEvent.press(screen.getByRole('button', { name: end.toLocaleDateString('en-US', { dateStyle: 'full' }) }));
  expect(screen.getByTestId('range')).toHaveTextContent(`${dateKey(start)} / ${dateKey(end)}`);
  await fireEvent.press(screen.getByRole('button', { name: end.toLocaleDateString('en-US', { dateStyle: 'full' }) }));
  expect(screen.getByTestId('range')).toHaveTextContent(`${dateKey(end)} /`);
});
