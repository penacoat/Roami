import React from 'react';
import { expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PlacePostcards } from '../src/screens/map/PlacePostcards';
import { RECOMMENDATIONS } from '../src/api/fixtureData';

it('groups multiple saved postcards under one place and switches to all public postcards', async () => {
  const all = RECOMMENDATIONS.filter((item) => item.place.id === 'p-jazz');
  const remove = jest.fn();
  await render(
    <PlacePostcards
      recommendations={all}
      saved={all}
      loading={false}
      error=""
      pending={false}
      sample={false}
      onRetry={() => {}}
      onSave={() => {}}
      onRemove={remove}
    />,
  );
  expect(screen.getByRole('tab', { name: 'Saved postcards (2)' })).toBeSelected();
  expect(screen.getByText('Postcard from Maya')).toBeTruthy();
  expect(screen.getByText('Postcard from Jonas')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Unsave recommendation by Jonas' }));
  expect(remove).toHaveBeenCalledWith('r8');
  await fireEvent.press(screen.getByRole('tab', { name: 'All postcards' }));
  expect(screen.getByRole('tab', { name: 'All postcards' })).toBeSelected();
  expect(screen.queryByText(/friend/i)).toBeNull();
});
