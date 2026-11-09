import type { TripView } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { tripDays, formatDate } from '../trips/tripDraft';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { itineraryStyles as styles } from '../trips/itineraryStyles';

export function ItineraryScreen({
  tripId,
  onBack,
  onExplore,
  onOpenPlace,
}: {
  tripId: string;
  onBack: () => void;
  onExplore: () => void;
  onOpenPlace: (placeId: string) => void;
}) {
  const [view, setView] = useState<TripView | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const loadKey = JSON.stringify([tripId, retry]);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let active = true;
    callApi('getTrip', { tripId })
      .then(({ trip }) => {
        if (active) {
          setView(trip);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load this itinerary. Try again.');
      })
      .finally(() => {
        if (active) setLoadedKey(loadKey);
      });
    return () => {
      active = false;
    };
  }, [tripId, loadKey]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}>
          <Text style={styles.buttonText}>← Itineraries</Text>
        </Pressable>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading itinerary" />
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
        ) : view ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {view.trip.city}
            </Text>
            <Text style={styles.muted}>
              {formatDate(view.trip.startDate)} – {formatDate(view.trip.endDate)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onExplore}
              style={[styles.button, styles.primary]}
            >
              <Text style={styles.primaryText}>Explore places to add</Text>
            </Pressable>
            {Array.from(
              { length: tripDays(view.trip.startDate, view.trip.endDate) },
              (_, index) => index + 1,
            ).map((day) => {
              const stops = view.stops.filter((stop) => stop.day === day);
              return (
                <View key={day} style={{ gap: 10 }}>
                  <Text accessibilityRole="header" style={styles.heading}>
                    {itineraryDayLabel(view.trip.startDate, day)}
                  </Text>
                  {stops.length === 0 && <Text style={styles.muted}>No places yet.</Text>}
                  {stops.map((stop) =>
                    stop.place ? (
                      <Pressable
                        key={stop.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${stop.place.name}`}
                        style={styles.card}
                        onPress={() => onOpenPlace(stop.place!.id)}
                      >
                        <Text style={styles.text}>
                          {stop.order}. {stop.place.name}
                        </Text>
                        <Text style={styles.muted}>{stop.visitMinutes} min</Text>
                      </Pressable>
                    ) : (
                      <View key={stop.id} style={styles.card}>
                        <Text style={styles.text}>{stop.title ?? 'Place unavailable'}</Text>
                      </View>
                    ),
                  )}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
