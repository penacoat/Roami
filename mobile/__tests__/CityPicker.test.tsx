import React from 'react';
import { afterEach, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as api from '../src/api/ApiClient';
import { CityPicker } from '../src/cities/CityPicker';
import { testCities } from '../test-utils/cities';
import * as location from '../src/cities/currentCity';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
afterEach(() => {
  jest.restoreAllMocks();
});

it('only selects returned cities and ignores an older search that finishes later', async () => {
  let resolve!: (value: { cities: typeof testCities }) => void;
  jest
    .spyOn(api, 'callApi')
    .mockImplementationOnce(
      () =>
        new Promise((yes) => {
          resolve = yes;
        }),
    )
    .mockResolvedValueOnce({ cities: [testCities[2]] });
  const select = jest.fn();
  const close = jest.fn();
  await render(<CityPicker current={testCities[0]} onSelect={select} onClose={close} />);
  await fireEvent.changeText(screen.getByLabelText('City name'), 'Portl');
  await act(async () => {
    await new Promise((yes) => setTimeout(yes, 330));
  });
  await fireEvent.changeText(screen.getByLabelText('City name'), 'Los');
  const result = await screen.findByRole('button', { name: /^Select city: Los Angeles/ });
  await act(async () => resolve({ cities: [testCities[1]] }));
  expect(screen.queryByRole('button', { name: /^Select city: Portland/ })).toBeNull();
  await fireEvent.press(result);
  expect(select).toHaveBeenCalledWith(testCities[2]);
  expect(close).toHaveBeenCalled();
});

it('explains an invalid search and keeps the existing city unchanged', async () => {
  jest.spyOn(api, 'callApi').mockResolvedValue({ cities: [] });
  const select = jest.fn();
  await render(<CityPicker current={testCities[0]} onSelect={select} onClose={() => {}} />);
  await fireEvent.changeText(screen.getByLabelText('City name'), 'notacityxyz');
  await screen.findByText('No matching city found. Check the spelling or add a region or country.');
  expect(select).not.toHaveBeenCalled();
});

it('selects the located city through the same shared city control', async () => {
  jest.spyOn(location, 'currentCity').mockResolvedValue(testCities[1]);
  const select = jest.fn();
  const close = jest.fn();
  await render(<CityPicker current={testCities[0]} onSelect={select} onClose={close} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Use current location' }));
  expect(select).toHaveBeenCalledWith(testCities[1]);
  expect(close).toHaveBeenCalled();
});

it('ignores a late location result after the user starts typing a city', async () => {
  let resolve!: (value: (typeof testCities)[number]) => void;
  jest.spyOn(location, 'currentCity').mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const select = jest.fn();
  await render(<CityPicker current={testCities[0]} onSelect={select} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Use current location' }));
  await fireEvent.changeText(screen.getByLabelText('City name'), 'P');
  await act(async () => resolve(testCities[1]));
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByText('Finding your city…')).toBeNull();
});

it('leaves city search usable after location fails', async () => {
  jest.spyOn(location, 'currentCity').mockRejectedValue(new Error('Location access is off.'));
  const select = jest.fn();
  await render(<CityPicker current={testCities[0]} onSelect={select} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Use current location' }));
  await screen.findByText('Location access is off.');
  expect(select).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Use current location' })).toBeEnabled();
});
