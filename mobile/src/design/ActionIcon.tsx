import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { palette } from './tokens';

/** Shared strokes for the place actions, without loading an icon font. */
export function ActionIcon({ name }: { name: 'check' | 'plus' | 'location' }) {
  const paths = {
    check: 'M 4 10 L 8 14 L 16 5',
    plus: 'M 10 3 V 17 M 3 10 H 17',
    location: 'M 17 3 L 11 17 L 8 12 L 3 9 Z',
  };
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" aria-hidden>
      <Path
        d={paths[name]}
        fill="none"
        stroke={palette.primary}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
