import type { PlaceSummary, Trip, TripView } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { callApi } from '../api';
import { AddToItinerary } from '../components/AddToItinerary';
import { itineraryDayLabel } from './itineraryDayLabel';
import { itineraryStyles as styles } from './itineraryStyles';
import { DEFAULT_END, DEFAULT_START, rangeFromMinutes } from './stopTime';
import { HoursWarning } from './StopInsights';
import { TimeRangePicker } from './TimeRangePicker';

export function DayPlacePicker({
  view,
  day,
  onChanged,
  onExplore,
}: {
  view: TripView;
  day: number;
  onChanged: (trip: TripView) => void;
  onExplore: () => void;
}) {
  const [places, setPlaces] = useState<PlaceSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    callApi('listSavedPlaces', {})
      .then(({ saved }) => {
        if (active) setPlaces(saved.map((item) => item.place));
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const choices = places && [
    ...new Map([...view.candidates, ...places].map((place) => [place.id, place])).values(),
  ];
  return (
    <View style={styles.card}>
      <Text style={styles.text}>Choose a place for Day {day}</Text>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>
            Could not load saved places.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => {
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </>
      ) : !choices ? (
        <ActivityIndicator accessibilityLabel="Loading saved places" />
      ) : (
        <>
          {choices.length === 0 && (
            <Text style={styles.muted}>Save places in Explore to add them here.</Text>
          )}
          {choices.map((place) => {
            const scheduled = view.stops.find((stop) => stop.placeId === place.id);
            return (
              <View key={place.id} style={{ gap: 4 }}>
                <AddToItinerary
                  place={place}
                  target={{ tripId: view.trip.id, day }}
                  onChanged={onChanged}
                />
                {scheduled && (
                  <Text style={styles.muted}>
                    Scheduled · {itineraryDayLabel(view.trip.startDate, scheduled.day)}
                  </Text>
                )}
              </View>
            );
          })}
          <Pressable accessibilityRole="button" onPress={onExplore} style={styles.button}>
            <Text style={styles.buttonText}>Explore places</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export function FixedActivityForm({
  day,
  hours,
  pending,
  onSave,
}: {
  day: number;
  hours: Trip['dailyWindow'];
  pending: boolean;
  onSave: (activity: {
    title: string;
    startTime: string;
    visitMinutes: number;
  }) => Promise<string | undefined>;
}) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [error, setError] = useState('');
  const draft = rangeFromMinutes(start, end);

  async function save() {
    const range = rangeFromMinutes(start, end);
    if (!title.trim()) {
      setError('Enter an activity or reservation name.');
      return;
    }
    if (!range.ok) {
      setError(range.error);
      return;
    }
    setError('');
    const failure = await onSave({
      title: title.trim(),
      startTime: range.startTime,
      visitMinutes: range.visitMinutes,
    });
    if (failure) setError(failure);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.text}>Add a fixed activity or reservation to Day {day}</Text>
      <TextInput
        accessibilityLabel="Activity or reservation name"
        placeholder="e.g. Dinner reservation"
        style={styles.input}
        value={title}
        editable={!pending}
        maxLength={200}
        onChangeText={(value) => {
          setTitle(value);
          setError('');
        }}
      />
      <TimeRangePicker
        start={start}
        end={end}
        disabled={pending}
        onChange={(from, to) => {
          setStart(from);
          setEnd(to);
          setError('');
        }}
      />
      {draft.ok && <HoursWarning stop={draft} hours={hours} />}
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={() => void save()}
        style={[styles.button, styles.primary, pending && styles.disabled]}
      >
        <Text style={styles.primaryText}>{pending ? 'Saving…' : 'Save fixed activity'}</Text>
      </Pressable>
    </View>
  );
}
