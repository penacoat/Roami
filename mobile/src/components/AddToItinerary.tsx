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

import { ApiError, callApi } from '../api';
import { DEFAULT_VISIT_MINUTES, MAX_STOPS_PER_DAY } from '../logic/trips';
import { tripDays, formatDate } from '../trips/tripDraft';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { itineraryStyles as styles } from '../trips/itineraryStyles';
import { DEFAULT_END, DEFAULT_START, formatTimeRange, rangeFromMinutes } from '../trips/stopTime';
import { HoursWarning } from '../trips/StopInsights';
import { TimeRangePicker } from '../trips/TimeRangePicker';

export function AddToItinerary({
  place,
  recommendationIds = [],
  target,
  onChanged,
}: {
  place: PlaceSummary;
  recommendationIds?: string[];
  target?: { tripId: string; day: number };
  onChanged?: (trip: TripView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<TripView | null>(null);
  const [day, setDay] = useState(1);
  const [timed, setTimed] = useState(false);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [timeError, setTimeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<'stop' | 'candidate' | null>(null);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = selectedId
      ? callApi('getTrip', { tripId: selectedId }).then(({ trip }) => {
          if (active) setSelected(trip);
        })
      : callApi('listTrips', { includeScheduledPlaces: true }).then(({ trips: items }) => {
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
  const existing = selected?.stops.find((stop) => stop.placeId === place.id);
  const duplicate = Boolean(existing);
  const suggested = selected?.candidates.some((item) => item.id === place.id);
  const suggestionSaved =
    suggested &&
    recommendationIds.every((id) =>
      selected?.trip.candidateRecommendationIds?.[place.id]?.includes(id),
    );
  const full = stops.length >= MAX_STOPS_PER_DAY;
  const draftTime = timed ? rangeFromMinutes(start, end) : null;

  // Without a time, the place is added untimed; it can be set later on the itinerary.
  function readTimes(): { startTime: string | null; visitMinutes: number } | null {
    if (!timed) return { startTime: null, visitMinutes: DEFAULT_VISIT_MINUTES };
    const range = rangeFromMinutes(start, end);
    if (!range.ok) {
      setTimeError(range.error);
      return null;
    }
    return { startTime: range.startTime, visitMinutes: range.visitMinutes };
  }

  async function add(kind: 'stop' | 'candidate') {
    if (!selected || busy.current || duplicate || (kind === 'stop' && (full || day > days))) return;
    const times = kind === 'stop' ? readTimes() : null;
    if (kind === 'stop' && !times) return;
    setTimeError('');
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const selection = {
        tripId: selected.trip.id,
        placeId: place.id,
        recommendationIds: [...new Set(recommendationIds)],
      };
      const result = times
        ? await callApi('addStop', {
            ...selection,
            expectedRevision: selected.trip.revision,
            day,
            ...times,
          })
        : await callApi('addCandidate', selection);
      setSelected(result.trip);
      setAdded(kind);
      onChanged?.(result.trip);
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
        setError(
          failure instanceof ApiError && failure.code === 'invalid-argument'
            ? failure.message
            : 'Could not add this place. Try again.',
        );
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
        accessibilityLabel={
          target ? `Plan ${place.name} for Day ${target.day}` : `Add ${place.name} to an itinerary`
        }
        style={styles.button}
        onPress={() => {
          setLoading(true);
          setSelected(null);
          setSelectedId(target?.tripId ?? '');
          setDay(target?.day ?? 1);
          setTimed(false);
          setStart(DEFAULT_START);
          setEnd(DEFAULT_END);
          setTimeError('');
          setAdded(null);
          setError('');
          setOpen(true);
        }}
      >
        <Text style={styles.buttonText}>{target ? place.name : 'Add to itinerary'}</Text>
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
                  {added === 'candidate'
                    ? `Saved as a suggestion for ${selected.trip.city}.`
                    : `Added to ${selected.trip.city} · Day ${day}${
                        existing?.startTime
                          ? ` · ${formatTimeRange(existing.startTime, existing.visitMinutes)}`
                          : ''
                      }`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.button, styles.primary]}
                  onPress={() => {
                    close();
                    if (!target)
                      router.push({
                        pathname: '/itinerary/[tripId]',
                        params: { tripId: selected.trip.id },
                      });
                  }}
                >
                  <Text style={styles.primaryText}>{target ? 'Done' : 'View itinerary'}</Text>
                </Pressable>
              </>
            ) : selected ? (
              <>
                {!target && (
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
                )}
                <Text style={styles.heading}>{selected.trip.city}</Text>
                {target ? (
                  <Text style={styles.text}>{itineraryDayLabel(selected.trip.startDate, day)}</Text>
                ) : (
                  <>
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
                  </>
                )}
                {!duplicate && !full && (
                  <>
                    <Text style={styles.text}>Time</Text>
                    <Text style={styles.muted}>Optional. You can set or change it later.</Text>
                    {timed ? (
                      <>
                        <TimeRangePicker
                          start={start}
                          end={end}
                          disabled={pending}
                          onChange={(nextStart, nextEnd) => {
                            setStart(nextStart);
                            setEnd(nextEnd);
                            setTimeError('');
                          }}
                        />
                        <Pressable
                          accessibilityRole="button"
                          disabled={pending}
                          onPress={() => {
                            setTimed(false);
                            setTimeError('');
                          }}
                          style={[styles.button, { alignSelf: 'flex-start' }]}
                        >
                          <Text style={styles.buttonText}>Remove time</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={pending}
                        onPress={() => setTimed(true)}
                        style={[styles.button, { alignSelf: 'flex-start' }]}
                      >
                        <Text style={styles.buttonText}>Add a time</Text>
                      </Pressable>
                    )}
                    {draftTime?.ok && (
                      <HoursWarning stop={draftTime} hours={selected.trip.dailyWindow} />
                    )}
                    {timeError !== '' && (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {timeError}
                      </Text>
                    )}
                  </>
                )}
                {existing ? (
                  <Text style={styles.muted}>
                    Already scheduled · {itineraryDayLabel(selected.trip.startDate, existing.day)}
                  </Text>
                ) : full ? (
                  <Text style={styles.muted}>
                    This day has {MAX_STOPS_PER_DAY} stops. Choose another day or save a trip
                    suggestion.
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: pending || duplicate || full, busy: pending }}
                  disabled={pending || duplicate || full}
                  onPress={() => void add('stop')}
                  style={[
                    styles.button,
                    styles.primary,
                    (pending || duplicate || full) && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryText}>{pending ? 'Adding…' : 'Add place'}</Text>
                </Pressable>
                {!duplicate && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={pending || suggestionSaved}
                    accessibilityState={{ disabled: pending || suggestionSaved }}
                    onPress={() => void add('candidate')}
                    style={[styles.button, (pending || suggestionSaved) && styles.disabled]}
                  >
                    <Text style={styles.buttonText}>
                      {suggestionSaved
                        ? 'Already a trip suggestion'
                        : suggested
                          ? 'Keep this tip with the suggestion'
                          : 'Save as a trip suggestion'}
                    </Text>
                  </Pressable>
                )}
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
                    {trip.scheduledPlaces
                      ?.filter((stop) => stop.placeId === place.id)
                      .map((stop) => (
                        <Text key={stop.day} style={styles.muted}>
                          Scheduled · {itineraryDayLabel(trip.startDate, stop.day)}
                        </Text>
                      ))}
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
