import React, { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { itineraryStyles as styles } from '../trips/itineraryStyles';

export type ShareItem = { id: string; label: string; text: string };

export function SharePicker({ title, items }: { title: string; items: ShareItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const included = items.filter((item) => selected.includes(item.id));
  const message = [title, ...included.map((item) => item.text)].join('\n');

  async function share() {
    setError('');
    try {
      await Share.share({ title, message });
    } catch {
      setError('Sharing is unavailable right now.');
    }
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Choose what to share
      </Text>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="checkbox"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: selected.includes(item.id) }}
          style={[styles.button, selected.includes(item.id) && styles.selected]}
          onPress={() =>
            setSelected((current) =>
              current.includes(item.id)
                ? current.filter((id) => id !== item.id)
                : [...current, item.id],
            )
          }
        >
          <Text style={styles.buttonText}>
            {selected.includes(item.id) ? '✓ ' : ''}
            {item.label}
          </Text>
        </Pressable>
      ))}
      {included.length > 0 && <Text style={styles.muted}>{message}</Text>}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={included.length === 0}
        style={[styles.button, styles.primary, included.length === 0 && styles.disabled]}
        onPress={() => void share()}
      >
        <Text style={styles.primaryText}>Open share sheet</Text>
      </Pressable>
    </View>
  );
}
