import React, { forwardRef, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path, type PathProps } from 'react-native-svg';
import { palette } from './tokens';
import { useReducedMotion } from './useReducedMotion';

// A single stroke. The final i rises into a 10-unit pin loop, then continues
// into the exit line. Its loop is smaller than the letters' 25-unit x-height.
export const ROAMI_PATH = `M -40 64 C 15 75 45 72 72 58
 C 82 53 88 44 92 39 C 94 48 101 47 105 44 C 109 41 112 43 107 49
 C 101 58 100 66 112 63 C 116 62 120 59 124 54
 C 128 34 156 37 154 53 C 152 69 129 70 126 57
 C 124 48 133 41 143 43 C 151 45 154 51 165 49
 C 174 35 195 38 192 53 C 188 70 169 68 169 57
 C 167 48 175 43 189 43 C 195 42 195 43 191 53
 C 187 63 194 68 202 61 C 207 55 210 44 212 43
 C 213 41 209 57 207 62 C 216 40 229 37 229 48
 C 228 53 225 61 228 62 C 239 40 251 38 249 50
 C 244 63 249 68 259 60 C 264 55 267 47 271 39
 C 273 35 268 32 269 28 C 270 22 279 22 279 28
 C 279 32 275 35 273 38 C 271 43 268 52 266 57
 C 265 66 276 66 286 59 C 309 43 326 48 348 57 C 372 66 400 64 420 57`;

// Identical command structure lets Animated interpolate the handwriting into
// a loose wave as its tail leaves the screen, rather than just fading a logo.
let coordinate = 0;
let x = 0;
const LOOSE_PATH = ROAMI_PATH.replace(/-?\d+(?:\.\d+)?/g, (number) => {
  const value = Number(number);
  if (coordinate++ % 2 === 0) {
    x = value;
    return number;
  }
  return (60 + (value - 60) * 0.12 + Math.sin(x / 29) * 7).toFixed(2);
});
const Stroke = forwardRef<Path, PathProps & { collapsable?: boolean }>(function Stroke(
  { collapsable: _collapsable, ...props },
  ref,
) {
  return <Path {...props} ref={ref} />;
});
const AnimatedPath = Animated.createAnimatedComponent(Stroke);
const STROKE_LENGTH = 884;
const LOOSE_LENGTH = 654;

export function RoamingRibbon({
  color = palette.card,
  animate = true,
}: {
  color?: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  // Form and release in one breath: the curve changes direction without a hold.
  const shape = progress.interpolate({
    inputRange: [0, 0.43, 1],
    outputRange: [0, 1, 0],
    easing: Easing.inOut(Easing.sin),
  });
  const length = shape.interpolate({
    inputRange: [0, 1],
    outputRange: [LOOSE_LENGTH, STROKE_LENGTH],
  });
  // Follow the changing path length so the next pass has no long blank gap.
  const trim = Animated.multiply(
    length,
    progress.interpolate({ inputRange: [0, 0.48, 1], outputRange: [1, 0, -1] }),
  );
  useEffect(() => {
    if (reduced || !animate) return;
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 3600,
        easing: Easing.linear,
        useNativeDriver: false,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [animate, progress, reduced]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            translateX:
              reduced || !animate
                ? 0
                : progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] }),
          },
        ],
      }}
    >
      <Svg width="100%" height={104} viewBox="0 0 380 100" aria-hidden>
        {reduced || !animate ? (
          <Path
            d={ROAMI_PATH}
            fill="none"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <AnimatedPath
            d={shape.interpolate({
              inputRange: [0, 1],
              outputRange: [LOOSE_PATH, ROAMI_PATH],
            })}
            fill="none"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[STROKE_LENGTH, STROKE_LENGTH]}
            strokeDashoffset={trim}
          />
        )}
      </Svg>
    </Animated.View>
  );
}

export function RoamiLoading({ label = 'Loading Roami' }: { label?: string }) {
  return (
    <View
      style={styles.loading}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <RoamingRibbon />
    </View>
  );
}
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: palette.navy, overflow: 'hidden' },
});
