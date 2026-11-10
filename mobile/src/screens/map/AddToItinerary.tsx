import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlaceSummary, TripSummary } from '@roami/shared';
import { ApiError, callApi } from '../../api';
import { tripDays } from '../../trips/tripDraft';
import { colors } from './theme';

const VISIT_MINUTES = 60;

interface Props {
  place: PlaceSummary;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'aborted')
      return 'This trip changed while you were adding. Please try again.';
    if (error.code === 'invalid-argument') return error.message;
  }
  return 'Could not add to your itinerary. Please try again.';
}

/** "Add to itinerary" for a place: pick one of your trips and a day. */
export function AddToItinerary({ place }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [tripId, setTripId] = useState('');
  const [day, setDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const trip = trips.find((t) => t.id === tripId);
  const dayCount = trip ? tripDays(trip.startDate, trip.endDate) : 0;

  async function openPicker() {
    setOpen(true);
    setLoading(true);
    setMessage('');
    setFailed(false);
    try {
      const { trips: list } = await callApi('listTrips', {});
      setTrips(list);
      setTripId((current) => (list.some((t) => t.id === current) ? current : (list[0]?.id ?? '')));
      setDay(1);
    } catch {
      setFailed(true);
      setMessage('Could not load your trips. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!trip || adding) return;
    setAdding(true);
    setMessage('');
    setFailed(false);
    try {
      // Load the latest revision right before saving so the edit is not stale.
      const { trip: current } = await callApi('getTrip', { tripId: trip.id });
      await callApi('addStop', {
        tripId: trip.id,
        expectedRevision: current.trip.revision,
        placeId: place.id,
        day,
        visitMinutes: VISIT_MINUTES,
      });
      setMessage(`Added ${place.name} to Day ${day} of your ${trip.city} trip ✓`);
      setTrips((list) =>
        list.map((t) => (t.id === trip.id ? { ...t, stopCount: t.stopCount + 1 } : t)),
      );
    } catch (error) {
      setFailed(true);
      setMessage(describeError(error));
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to itinerary"
        accessibilityState={{ expanded: open }}
        onPress={() => (open ? setOpen(false) : void openPicker())}
        style={styles.toggle}
      >
        <Text style={styles.toggleText}>
          {open ? 'Close itinerary options' : 'Add to itinerary'}
        </Text>
      </Pressable>
      {open && loading && (
        <ActivityIndicator accessibilityLabel="Loading your trips" color={colors.ink} />
      )}
      {open && !loading && trips.length === 0 && !failed && (
        <Text style={styles.text}>
          You have no trips yet. Create one in the Build Trip tab, then add this place.
        </Text>
      )}
      {open && !loading && trips.length > 0 && (
        <View style={styles.picker}>
          <Text style={styles.label}>Trip</Text>
          <View style={styles.chips}>
            {trips.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityState={{ selected: t.id === tripId }}
                onPress={() => {
                  setTripId(t.id);
                  setDay(1);
                  setMessage('');
                }}
                style={[styles.chip, t.id === tripId && styles.chipOn]}
              >
                <Text style={[styles.chipText, t.id === tripId && styles.chipTextOn]}>
                  {t.city} · {t.startDate}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Day</Text>
          <View style={styles.chips}>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`Day ${n}`}
                accessibilityState={{ selected: n === day }}
                onPress={() => {
                  setDay(n);
                  setMessage('');
                }}
                style={[styles.chip, n === day && styles.chipOn]}
              >
                <Text style={[styles.chipText, n === day && styles.chipTextOn]}>Day {n}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add to Day ${day}`}
            accessibilityState={{ disabled: adding, busy: adding }}
            disabled={adding}
            onPress={() => void add()}
            style={styles.confirm}
          >
            <Text style={styles.confirmText}>{adding ? 'Adding…' : `Add to Day ${day}`}</Text>
          </Pressable>
        </View>
      )}
      {open && message !== '' && (
        <Text
          accessibilityRole={failed ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
          style={styles.text}
        >
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  toggle: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  toggleText: { color: colors.primary, fontWeight: '600' },
  picker: { gap: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextOn: { color: colors.white, fontWeight: '600' },
  confirm: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: colors.white, fontWeight: '600' },
  text: { color: colors.ink, fontSize: 13, lineHeight: 20 },
});
