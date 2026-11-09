import type { PlaceSummary, TripSummary, TripView } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { callApi } from '../api';
import { MAX_STOPS_PER_DAY } from '../logic/trips';
import { tripDays, formatDate } from '../trips/tripDraft';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { itineraryStyles as styles } from '../trips/itineraryStyles';

export function AddToItinerary({ place }: { place: PlaceSummary }) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<TripView | null>(null);
  const [day, setDay] = useState(1);
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = selectedId
      ? callApi('getTrip', { tripId: selectedId }).then(({ trip }) => {
          if (active) setSelected(trip);
        })
      : callApi('listTrips', {}).then(({ trips: items }) => {
          if (active) setTrips(items);
        });
    load
      .catch(() => {
        if (active) setError('Could not load itineraries. Try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, selectedId, retry]);

  const days = selected ? tripDays(selected.trip.startDate, selected.trip.endDate) : 0;
  const stops = selected?.stops.filter((stop) => stop.day === day) ?? [];
  const duplicate = stops.some((stop) => stop.placeId === place.id);
  const full = stops.length >= MAX_STOPS_PER_DAY;

  async function add() {
    if (!selected || busy.current || duplicate || full || day > days) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const result = await callApi('addStop', {
        tripId: selected.trip.id,
        expectedRevision: selected.trip.revision,
        placeId: place.id,
        day,
        visitMinutes: minutes,
      });
      setSelected(result.trip);
      setAdded(true);
    } catch (failure) {
      if (
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 'aborted'
      ) {
        setError('This itinerary changed. Review the day and try again.');
        setLoading(true);
        setSelected(null);
        setRetry((value) => value + 1);
      } else {
        setError('Could not add this place. Try again.');
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function close() {
    if (!busy.current) setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${place.name} to an itinerary`}
        style={styles.button}
        onPress={() => {
          setLoading(true);
          setSelected(null);
          setSelectedId('');
          setDay(1);
          setMinutes(60);
          setAdded(false);
          setError('');
          setOpen(true);
        }}
      >
        <Text style={styles.buttonText}>Add to itinerary</Text>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={close}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={[styles.heading, local.heading]}>
                {place.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                disabled={pending}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
            {error !== '' && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {loading ? (
              <ActivityIndicator accessibilityLabel="Loading itineraries" />
            ) : added && selected ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.text}>
                  Added to {selected.trip.city} · Day {day}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.button, styles.primary]}
                  onPress={() => {
                    close();
                    router.push({
                      pathname: '/itinerary/[tripId]',
                      params: { tripId: selected.trip.id },
                    });
                  }}
                >
                  <Text style={styles.primaryText}>View itinerary</Text>
                </Pressable>
              </>
            ) : selected ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={pending}
                  style={styles.button}
                  onPress={() => {
                    setLoading(true);
                    setSelected(null);
                    setSelectedId('');
                    setError('');
                  }}
                >
                  <Text style={styles.buttonText}>← Change itinerary</Text>
                </Pressable>
                <Text style={styles.heading}>{selected.trip.city}</Text>
                <Text style={styles.text}>Choose a day</Text>
                <View style={styles.wrap}>
                  {Array.from({ length: days }, (_, index) => index + 1).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: day === value, disabled: pending }}
                      disabled={pending}
                      onPress={() => {
                        setDay(value);
                        setError('');
                      }}
                      style={[styles.button, day === value && styles.selected]}
                    >
                      <Text style={styles.buttonText}>
                        {itineraryDayLabel(selected.trip.startDate, value)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.text}>Visit length</Text>
                <View style={styles.wrap}>
                  {[30, 60, 90, 120].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: minutes === value, disabled: pending }}
                      disabled={pending}
                      onPress={() => setMinutes(value)}
                      style={[styles.button, minutes === value && styles.selected]}
                    >
                      <Text style={styles.buttonText}>{value} min</Text>
                    </Pressable>
                  ))}
                </View>
                {duplicate ? (
                  <Text style={styles.muted}>Already on this day.</Text>
                ) : full ? (
                  <Text style={styles.muted}>This day has five stops. Choose another day.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending || duplicate || full, busy: pending }}
                  disabled={pending || duplicate || full}
                  onPress={() => void add()}
                  style={[
                    styles.button,
                    styles.primary,
                    (pending || duplicate || full) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryText}>{pending ? 'Adding…' : 'Add place'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.heading}>Choose an itinerary</Text>
                {trips.map((trip) => (
                  <Pressable
                    key={trip.id}
                    accessibilityRole="button"
                    style={styles.card}
                    onPress={() => {
                      setLoading(true);
                      setSelected(null);
                      setSelectedId(trip.id);
                      setDay(1);
                      setError('');
                    }}
                  >
                    <Text style={styles.heading}>{trip.city}</Text>
                    <Text style={styles.muted}>
                      {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                    </Text>
                  </Pressable>
                ))}
                {trips.length === 0 && !error && (
                  <Text style={styles.text}>Create an itinerary in the Itineraries tab first.</Text>
                )}
              </>
            )}
            {error !== '' && !loading && !selected && (
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => {
                  setLoading(true);
                  setSelected(null);
                  setError('');
                  setRetry((value) => value + 1);
                }}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const local = StyleSheet.create({ heading: { flex: 1 } });
