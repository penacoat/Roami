import type { TripSummary } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { formatDate } from '../trips/tripDraft';
import { itineraryStyles as styles } from '../trips/itineraryStyles';

export function ItinerariesScreen({
  refreshKey,
  onOpen,
  onCreate,
}: {
  refreshKey: number;
  onOpen: (tripId: string) => void;
  onCreate: () => void;
}) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const loadKey = JSON.stringify([refreshKey, retry]);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let active = true;
    callApi('listTrips', {})
      .then(({ trips }) => {
        if (active) {
          setTrips(trips);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load itineraries. Try again.');
      })
      .finally(() => {
        if (active) setLoadedKey(loadKey);
      });
    return () => {
      active = false;
    };
  }, [loadKey]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Your itineraries
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCreate}
          style={[styles.button, styles.primary]}
        >
          <Text style={styles.primaryText}>New itinerary</Text>
        </Pressable>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading itineraries" />
        ) : error ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </>
        ) : trips.length === 0 ? (
          <Text style={styles.text}>No itineraries yet.</Text>
        ) : (
          trips.map((trip) => (
            <Pressable
              key={trip.id}
              accessibilityRole="button"
              accessibilityLabel={`Open itinerary: ${trip.city}, ${formatDate(trip.startDate)}`}
              onPress={() => onOpen(trip.id)}
              style={styles.card}
            >
              <Text style={styles.heading}>{trip.city}</Text>
              <Text style={styles.muted}>
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </Text>
              <Text style={styles.buttonText}>
                {trip.stopCount} {trip.stopCount === 1 ? 'stop' : 'stops'} · View itinerary →
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
