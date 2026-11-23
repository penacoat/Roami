import type { TripSummary, TripView } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { formatDate } from '../trips/tripDraft';

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function chooseTrip(trips: TripSummary[], today: string): TripSummary | null {
  return (
    trips.find((trip) => trip.startDate <= today && trip.endDate >= today) ??
    trips.find((trip) => trip.startDate > today) ??
    null
  );
}

export function HomeScreen({
  onOpenTrip,
  onCreateTrip,
}: {
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: () => void;
}) {
  const [trip, setTrip] = useState<TripView | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const loading = loadedKey !== String(retry);

  useEffect(() => {
    let active = true;
    const today = localDateKey(new Date());
    callApi('listTrips', {})
      .then(({ trips }) => {
        const selected = chooseTrip(trips, today);
        if (!selected) {
          if (active) setTrip(null);
          return null;
        }
        return callApi('getTrip', { tripId: selected.id }).then(({ trip: result }) => {
          if (active) setTrip(result);
        });
      })
      .then(() => {
        if (active) setError('');
      })
      .catch((failure: unknown) => {
        if (active) {
          const code =
            typeof failure === 'object' && failure !== null && 'code' in failure
              ? String(failure.code)
              : '';
          setError(
            code === 'unauthenticated'
              ? 'Sign in to see your trips.'
              : 'Could not load your trip. Check your connection and try again.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadedKey(String(retry));
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const today = localDateKey(new Date());
  const currentDay = trip
    ? Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${trip.trip.startDate}T00:00:00Z`)) /
          86_400_000,
      ) + 1
    : 0;
  const todayStops =
    trip?.trip.startDate && trip.trip.endDate && currentDay > 0
      ? trip.stops.filter((stop) => stop.day === currentDay)
      : [];
  const upcomingStops =
    trip?.stops
      .filter((stop) => {
        if (trip.trip.startDate > today) return true;
        return stop.day > currentDay;
      })
      .slice(0, 3) ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Roami
        </Text>
        <Text style={styles.subtitle}>Your next adventure, at a glance.</Text>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading your trip" />
        ) : error ? (
          <View style={styles.card}>
            <Text accessibilityRole="alert" style={styles.body}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRetry((value) => value + 1)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </View>
        ) : !trip ? (
          <View style={styles.card}>
            <Text style={styles.heading}>No upcoming trips</Text>
            <Text style={styles.body}>Create an itinerary to see your plans here.</Text>
            <Pressable accessibilityRole="button" onPress={onCreateTrip} style={styles.button}>
              <Text style={styles.buttonText}>Plan a trip</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {trip.trip.startDate <= today ? 'YOUR TRIP TODAY' : 'UP NEXT'}
            </Text>
            <Text style={styles.heading}>{trip.trip.city}</Text>
            <Text style={styles.body}>
              {formatDate(trip.trip.startDate)} – {formatDate(trip.trip.endDate)}
            </Text>
            {trip.trip.startDate <= today && trip.trip.endDate >= today ? (
              <>
                <Text accessibilityRole="header" style={styles.section}>
                  Today’s itinerary
                </Text>
                {todayStops.length ? (
                  todayStops.map((stop) => (
                    <Text key={stop.id} style={styles.stop}>
                      {stop.startTime ? `${stop.startTime} · ` : ''}
                      {stop.place?.name ?? stop.title ?? 'Scheduled activity'}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.body}>No activities scheduled for today.</Text>
                )}
              </>
            ) : null}
            {upcomingStops.length ? (
              <>
                <Text accessibilityRole="header" style={styles.section}>
                  Upcoming activities
                </Text>
                {upcomingStops.map((stop) => (
                  <Text key={stop.id} style={styles.stop}>
                    Day {stop.day}
                    {stop.startTime ? ` · ${stop.startTime}` : ''} ·{' '}
                    {stop.place?.name ?? stop.title ?? 'Scheduled activity'}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={styles.body}>No upcoming activities are scheduled.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenTrip(trip.trip.id)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Open itinerary</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3EEE2' },
  content: { padding: 20, gap: 12 },
  title: { color: '#283A70', fontSize: 36, fontWeight: '700' },
  subtitle: { color: '#505A72', fontSize: 16, marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 10 },
  eyebrow: { color: '#505A72', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heading: { color: '#283A70', fontSize: 26, fontWeight: '700' },
  section: { color: '#283A70', fontSize: 17, fontWeight: '700', marginTop: 8 },
  body: { color: '#505A72', fontSize: 14, lineHeight: 20 },
  stop: { color: '#283A70', fontSize: 14, lineHeight: 20 },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#283A70',
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
