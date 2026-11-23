import React from 'react';
import { expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PlacePhotos } from '../src/screens/map/PlacePhotos';

it('pages through API photos and retains their attribution', async () => {
  await render(
    <PlacePhotos
      name="Example"
      photos={[
        { url: 'https://example.test/1.jpg', attribution: 'Photo One' },
        { url: 'https://example.test/2.jpg', attribution: 'Photo Two' },
      ]}
    />,
  );
  expect(screen.getByRole('button', { name: 'Previous place photo' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next place photo' }));
  expect(screen.getByText('Photo Two · 2 / 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Next place photo' })).toBeDisabled();
});

it('shows no gallery when no usable photos were supplied', async () => {
  await render(<PlacePhotos name="Example" photos={[{ url: 'javascript:alert(1)' }]} />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByLabelText('Example photo 1')).toBeNull();
});
