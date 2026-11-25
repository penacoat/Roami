import { beforeEach, expect, it } from '@jest/globals';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { callApi, resetFixtures } from '../src/api';
import { WritePostcard } from '../src/components/recommendations/WritePostcard';

beforeEach(() => {
  resetFixtures();
});

it('sends a postcard and it shows up in the feed', async () => {
  let sent = 0;
  await render(<WritePostcard placeId="p-kerry" placeName="Kerry Park" onSent={() => sent++} />);
  await fireEvent.press(screen.getByText('✎ Write a postcard'));
  await fireEvent.changeText(screen.getByLabelText('Your note'), 'Go at sunset, bring a jacket.');
  await fireEvent.changeText(screen.getByLabelText('Tags'), 'views, , sunset');
  await fireEvent.press(screen.getByText('Send postcard'));
  await screen.findByText('Postcard sent! You can find it in Postcards.');
  expect(sent).toBe(1);

  const { items } = await callApi('getFeed', { city: 'Seattle' });
  const mine = items.find((item) => item.description === 'Go at sunset, bring a jacket.');
  expect(mine?.tags).toEqual(['views', 'sunset']);
});

it('asks for a note before sending', async () => {
  await render(<WritePostcard placeId="p-kerry" placeName="Kerry Park" onSent={() => {}} />);
  await fireEvent.press(screen.getByText('✎ Write a postcard'));
  await fireEvent.press(screen.getByText('Send postcard'));
  expect(screen.getByText('Please write a note before sending :)')).toBeTruthy();
});
