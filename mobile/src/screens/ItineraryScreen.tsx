import type { TripStopView, TripView } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { MAX_STOPS_PER_DAY } from '../logic/trips';
import { tripDays, formatDate } from '../trips/tripDraft';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { itineraryStyles as styles } from '../trips/itineraryStyles';
import {
  DEFAULT_END,
  DEFAULT_START,
  formatTimeRange,
  rangeFromMinutes,
  stopRange,
} from '../trips/stopTime';
import { TimeRangePicker } from '../trips/TimeRangePicker';

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
  const [pending, setPending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState(DEFAULT_START);
  const [editEnd, setEditEnd] = useState(DEFAULT_END);
  const [timeError, setTimeError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
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

  // Sends one stop change with the revision on screen. If someone else changed
  // the trip first, reload it so the user sees the current stops before retrying.
  async function change(
    run: (view: TripView) => Promise<{ trip: TripView }>,
    failureMessage: string,
    successMessage: string,
  ) {
    if (!view || busy.current) return;
    busy.current = true;
    setPending(true);
    setNotice('');
    try {
      const result = await run(view);
      setView(result.trip);
      setConfirmingId(null);
      setMovingId(null);
      setEditingId(null);
      setNotice(successMessage);
    } catch (failure) {
      setConfirmingId(null);
      setMovingId(null);
      if (
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 'aborted'
      ) {
        setEditingId(null);
        setNotice('This itinerary changed. Review it and try again.');
        setRetry((value) => value + 1);
      } else {
        setNotice(failureMessage);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function stopName(stop: TripStopView) {
    return stop.place?.name ?? stop.title ?? 'this place';
  }

  function remove(stop: TripStopView) {
    const name = stopName(stop);
    return change(
      (current) =>
        callApi('removeStop', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
        }),
      `Could not remove ${name}. Try again.`,
      `Removed ${name}.`,
    );
  }

  function move(stop: TripStopView, day: number, order: number) {
    const name = stopName(stop);
    return change(
      (current) =>
        callApi('moveStop', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
          day,
          order,
        }),
      `Could not move ${name}. Try again.`,
      day === stop.day ? `Moved ${name}.` : `Moved ${name} to Day ${day}.`,
    );
  }

  // Why a stop can't go to a day, or null if it can.
  function dayProblem(stop: TripStopView, day: number): string | null {
    if (!view) return null;
    if (day === stop.day) return 'current day';
    const dayStops = view.stops.filter((other) => other.day === day);
    if (stop.placeId && dayStops.some((other) => other.placeId === stop.placeId)) {
      return 'already there';
    }
    if (dayStops.length >= MAX_STOPS_PER_DAY) return 'full';
    return null;
  }

  function openTimeEditor(stop: TripStopView) {
    setNotice('');
    setConfirmingId(null);
    setMovingId(null);
    setTimeError('');
    const range = stopRange(stop);
    setEditStart(range.start);
    setEditEnd(range.end);
    setEditingId(stop.id);
  }

  function saveTime(stop: TripStopView) {
    const range = rangeFromMinutes(editStart, editEnd);
    if (!range.ok) {
      setTimeError(range.error);
      return;
    }
    setTimeError('');
    const name = stopName(stop);
    return change(
      (current) =>
        callApi('updateStopTime', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
          startTime: range.startTime,
          visitMinutes: range.visitMinutes,
        }),
      `Could not save the time for ${name}. Try again.`,
      `Set time for ${name}.`,
    );
  }

  function clearTime(stop: TripStopView) {
    const name = stopName(stop);
    return change(
      (current) =>
        callApi('updateStopTime', {
          tripId,
          expectedRevision: current.trip.revision,
          stopId: stop.id,
          startTime: null,
          visitMinutes: stop.visitMinutes,
        }),
      `Could not clear the time for ${name}. Try again.`,
      `Cleared the time for ${name}.`,
    );
  }

  const dayCount = view ? tripDays(view.trip.startDate, view.trip.endDate) : 0;

  function controlStyle(disabled: boolean) {
    return [styles.button, disabled && styles.disabled];
  }

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
            {notice ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.muted}>
                {notice}
              </Text>
            ) : null}
            {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
              const stops = view.stops.filter((stop) => stop.day === day);
              return (
                <View key={day} style={{ gap: 10 }}>
                  <Text accessibilityRole="header" style={styles.heading}>
                    {itineraryDayLabel(view.trip.startDate, day)}
                  </Text>
                  {stops.length === 0 && <Text style={styles.muted}>No places yet.</Text>}
                  {stops.map((stop, index) => {
                    const name = stopName(stop);
                    const first = index === 0;
                    const last = index === stops.length - 1;
                    return (
                      <View key={stop.id} style={styles.card}>
                        {stop.place ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${stop.place.name}`}
                            onPress={() => onOpenPlace(stop.place!.id)}
                          >
                            <Text style={styles.text}>
                              {stop.order}. {stop.place.name}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={styles.text}>{stop.title ?? 'Place unavailable'}</Text>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            stop.startTime
                              ? `Change time for ${name}, ${formatTimeRange(stop.startTime, stop.visitMinutes)}`
                              : `Set time for ${name}`
                          }
                          accessibilityState={{ disabled: pending }}
                          disabled={pending}
                          onPress={() => openTimeEditor(stop)}
                          style={styles.timeChip}
                        >
                          <Text style={styles.timeText}>
                            {stop.startTime
                              ? formatTimeRange(stop.startTime, stop.visitMinutes)
                              : 'Set time'}{' '}
                          </Text>
                        </Pressable>
                        {editingId === stop.id ? (
                          <View style={{ gap: 8 }}>
                            <TimeRangePicker
                              start={editStart}
                              end={editEnd}
                              subject={name}
                              disabled={pending}
                              onChange={(nextStart, nextEnd) => {
                                setEditStart(nextStart);
                                setEditEnd(nextEnd);
                                setTimeError('');
                              }}
                            />
                            {timeError ? (
                              <Text accessibilityRole="alert" style={styles.error}>
                                {timeError}
                              </Text>
                            ) : null}
                            <View style={styles.wrap}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Save time for ${name}`}
                                accessibilityState={{ disabled: pending, busy: pending }}
                                disabled={pending}
                                onPress={() => void saveTime(stop)}
                                style={[styles.button, styles.primary, pending && styles.disabled]}
                              >
                                <Text style={styles.primaryText}>Save time</Text>
                              </Pressable>
                              {stop.startTime && (
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Clear time for ${name}`}
                                  disabled={pending}
                                  onPress={() => void clearTime(stop)}
                                  style={controlStyle(pending)}
                                >
                                  <Text style={styles.buttonText}>Clear time</Text>
                                </Pressable>
                              )}
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Cancel editing time for ${name}`}
                                disabled={pending}
                                onPress={() => setEditingId(null)}
                                style={controlStyle(pending)}
                              >
                                <Text style={styles.buttonText}>Cancel</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : confirmingId === stop.id ? (
                          <View style={{ gap: 8 }}>
                            <Text style={styles.text}>Remove {name} from this itinerary?</Text>
                            <View style={styles.wrap}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Confirm removing ${name}`}
                                accessibilityState={{ disabled: pending, busy: pending }}
                                disabled={pending}
                                onPress={() => void remove(stop)}
                                style={[styles.button, styles.primary, pending && styles.disabled]}
                              >
                                <Text style={styles.primaryText}>Remove</Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Keep ${name}`}
                                disabled={pending}
                                onPress={() => setConfirmingId(null)}
                                style={controlStyle(pending)}
                              >
                                <Text style={styles.buttonText}>Keep</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : movingId === stop.id ? (
                          <View style={{ gap: 8 }}>
                            <Text style={styles.text}>Move {name} to which day?</Text>
                            <View style={styles.wrap}>
                              {Array.from({ length: dayCount }, (_, i) => i + 1).map((target) => {
                                const problem = dayProblem(stop, target);
                                const off = pending || problem !== null;
                                return (
                                  <Pressable
                                    key={target}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                      problem
                                        ? `Day ${target}, ${problem}`
                                        : `Move ${name} to Day ${target}`
                                    }
                                    accessibilityState={{ disabled: off }}
                                    disabled={off}
                                    onPress={() =>
                                      void move(
                                        stop,
                                        target,
                                        view.stops.filter((other) => other.day === target).length +
                                          1,
                                      )
                                    }
                                    style={controlStyle(off)}
                                  >
                                    <Text style={styles.buttonText}>Day {target}</Text>
                                  </Pressable>
                                );
                              })}
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Cancel moving ${name}`}
                                disabled={pending}
                                onPress={() => setMovingId(null)}
                                style={controlStyle(pending)}
                              >
                                <Text style={styles.buttonText}>Cancel</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.wrap}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Move ${name} earlier`}
                              accessibilityState={{ disabled: pending || first }}
                              disabled={pending || first}
                              onPress={() => void move(stop, stop.day, stop.order - 1)}
                              style={controlStyle(pending || first)}
                            >
                              <Text style={styles.buttonText}>↑ Earlier</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Move ${name} later`}
                              accessibilityState={{ disabled: pending || last }}
                              disabled={pending || last}
                              onPress={() => void move(stop, stop.day, stop.order + 1)}
                              style={controlStyle(pending || last)}
                            >
                              <Text style={styles.buttonText}>↓ Later</Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${name}`}
                              accessibilityState={{ disabled: pending }}
                              disabled={pending}
                              onPress={() => {
                                setNotice('');
                                setMovingId(null);
                                setEditingId(null);
                                setConfirmingId(stop.id);
                              }}
                              style={controlStyle(pending)}
                            >
                              <Text style={styles.buttonText}>Remove</Text>
                            </Pressable>
                            {dayCount > 1 && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Change day for ${name}`}
                                accessibilityState={{ disabled: pending }}
                                disabled={pending}
                                onPress={() => {
                                  setNotice('');
                                  setConfirmingId(null);
                                  setEditingId(null);
                                  setMovingId(stop.id);
                                }}
                                style={controlStyle(pending)}
                              >
                                <Text style={styles.buttonText}>Change day</Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
