import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { itineraryStyles as controls } from './itineraryStyles';
import { addTripPhotos, listTripPhotos, pickTripPhotos } from './tripPhotos';

export function TripMemories({
  ownerId,
  tripId,
  disabled,
  onBusy,
}: {
  ownerId: string;
  tripId: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => listTripPhotos(ownerId, tripId))
      .then((items) => {
        if (active) setPhotos(items);
      })
      .catch(() => {
        if (active) setError('Could not load your trip photos.');
      });
    return () => {
      active = false;
    };
  }, [ownerId, tripId]);

  async function addPhotos() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    onBusy(true);
    setError('');
    try {
      const selected = await pickTripPhotos();
      if (selected.length === 0) return;
      await addTripPhotos(ownerId, tripId, selected);
      setPhotos(listTripPhotos(ownerId, tripId));
    } catch {
      setError('Some photos could not be saved. Try adding them again.');
      try {
        setPhotos(listTripPhotos(ownerId, tripId));
      } catch {
        setPhotos([]);
      }
    } finally {
      busy.current = false;
      setSaving(false);
      onBusy(false);
    }
  }

  return (
    <View style={controls.card}>
      <Text accessibilityRole="header" style={controls.heading}>
        Trip memories
      </Text>
      <Text style={controls.muted}>Photos are stored on this device.</Text>
      {photos.length > 0 && (
        <ScrollView horizontal contentContainerStyle={styles.photos}>
          {photos.map((uri, index) => (
            <Image
              key={uri}
              source={{ uri }}
              style={styles.photo}
              accessible
              accessibilityLabel={`Trip photo ${index + 1}`}
            />
          ))}
        </ScrollView>
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={controls.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={disabled || saving}
        accessibilityState={{ disabled: disabled || saving, busy: saving }}
        style={[controls.button, (disabled || saving) && controls.disabled]}
        onPress={() => void addPhotos()}
      >
        <Text style={controls.buttonText}>{saving ? 'Adding photos…' : 'Add photos'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  photos: { gap: 8 },
  photo: { width: 132, height: 132, borderRadius: 8 },
});
