import type { CityLocation } from '@roami/shared';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, type } from '../design/tokens';
import { CityPicker } from './CityPicker';

/** One city control and search sheet wherever a city can be chosen. */
export function CitySelector({
  city,
  onSelect,
  onOpen,
  placeholder,
}: {
  city: CityLocation;
  onSelect: (city: CityLocation) => void;
  onOpen?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder ?? `Change city: ${city.name}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          onOpen?.();
          setOpen(true);
        }}
        style={styles.button}
      >
        <Text style={styles.label} numberOfLines={1}>
          {placeholder ?? city.name} ▾
        </Text>
      </Pressable>
      {open && <CityPicker current={city} onSelect={onSelect} onClose={() => setOpen(false)} />}
    </>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', flexShrink: 1 },
  label: { ...type.action, color: palette.primary },
});
