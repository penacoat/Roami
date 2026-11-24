import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts, palette } from './tokens';

export function Wordmark() {
  return (
    <View style={styles.mark} accessible accessibilityLabel="Roami">
      <Text accessible={false} style={styles.name}>
        Roam
      </Text>
      <View style={styles.lastLetter}>
        <Svg width={7} height={10} viewBox="0 0 10 14" style={styles.pin} aria-hidden>
          <Path
            d="M5 13 C4 10 1 7 1 5 A4 4 0 0 1 9 5 C9 7 6 10 5 13Z"
            fill="none"
            stroke="#D4836F"
            strokeWidth={1.4}
          />
        </Svg>
        <Text accessible={false} style={styles.name}>
          ı
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  mark: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 8,
    marginBottom: 36,
  },
  name: { color: palette.card, fontFamily: fonts.serif, fontSize: 28, lineHeight: 36 },
  lastLetter: { position: 'relative' },
  pin: { position: 'absolute', alignSelf: 'center', top: 0 },
});
