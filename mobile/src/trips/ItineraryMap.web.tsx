import type { Trip, TripStopView } from '@roami/shared';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { itineraryStyles as styles } from './itineraryStyles';

export function ItineraryMap({
  onList,
}: {
  stops: TripStopView[];
  hours: Trip['dailyWindow'];
  onList: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.muted}>Interactive map available in Expo Go.</Text>
      <Pressable accessibilityRole="button" onPress={onList} style={styles.button}>
        <Text style={styles.buttonText}>Show in day list</Text>
      </Pressable>
    </View>
  );
}
