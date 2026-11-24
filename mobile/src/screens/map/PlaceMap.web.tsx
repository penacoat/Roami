import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { PlaceMap as NativePlaceMap } from './PlaceMap';
import { palette, type } from '../../design/tokens';

/** Keep browser layout review honest; the interactive map is native. */
export function PlaceMap(_props: ComponentProps<typeof NativePlaceMap>) {
  return (
    <View style={styles.map}>
      <Text style={styles.label}>Interactive map available in Expo Go</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#E8E8DE',
    alignItems: 'center',
    paddingTop: 72,
  },
  label: { ...type.caption, color: palette.muted },
});
