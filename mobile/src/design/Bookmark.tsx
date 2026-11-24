import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { palette } from './tokens';

export function Bookmark({ saved }: { saved: boolean }) {
  return (
    <Svg width={20} height={22} viewBox="0 0 20 22" aria-hidden>
      <Path
        d="M 5 2 H 15 Q 17 2 17 4 V 20 L 10 15 L 3 20 V 4 Q 3 2 5 2 Z"
        fill={saved ? palette.primary : 'none'}
        stroke={palette.primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
