import type { ApplyItineraryRequest, TripView } from '@roami/shared';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { itineraryChanges, planItinerary, type ItineraryPlan } from '../logic/itineraryPlan';
import { DEFAULT_VISIT_MINUTES } from '../logic/trips';
import { itineraryDayLabel } from './itineraryDayLabel';
import { itineraryStyles as styles } from './itineraryStyles';
import { HoursWarning } from './StopInsights';
import { formatTimeRange } from './stopTime';

const strategies = ['earlier', 'later'] as const;
const optionNames = { earlier: 'Earlier times', later: 'Later times' };
type Strategy = ApplyItineraryRequest['strategy'];

export function ItineraryOptions({
  view,
  pending,
  onApply,
}: {
  view: TripView;
  pending: boolean;
  onApply: (placeIds: string[], strategy: Strategy) => Promise<string | undefined>;
}) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [plans, setPlans] = useState<ItineraryPlan[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const placeIds = view.candidates
    .filter((place) => !excluded.includes(place.id))
    .map((place) => place.id);
  const names = new Map(view.candidates.map((place) => [place.id, place.name]));
  const existing = new Map(view.stops.map((stop) => [stop.id, stop]));
  const hasUntimed = view.stops.some((stop) => !stop.isFixed && stop.startTime === null);
  const plan = plans[selected];

  function generate() {
    const options: ItineraryPlan[] = [];
    const seen = new Set<string>();
    for (const strategy of strategies) {
      const result = planItinerary(view.trip, view.stops, placeIds, strategy);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (itineraryChanges(view.stops, result.value).length === 0) continue;
      const key = JSON.stringify(result.value.stops);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(result.value);
    }
    setSelected(0);
    setPlans(options);
    setError(
      options.length
        ? ''
        : 'There is no room for these choices in your daily planning hours. Must-do and fixed activities stay on the itinerary.',
    );
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        Generate an itinerary
      </Text>
      <Text style={styles.muted}>
        Options use your daily planning hours and keep existing times. New suggestions get{' '}
        {DEFAULT_VISIT_MINUTES}
        minutes. Check opening hours and allow time to travel between stops.
      </Text>
      {view.candidates.length === 0 && !hasUntimed && (
        <Text style={styles.text}>
          Use Add place on a day to save a trip suggestion or add an untimed stop.
        </Text>
      )}
      {view.candidates.map((place) => {
        const checked = !excluded.includes(place.id);
        return (
          <Pressable
            key={place.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: pending }}
            accessibilityLabel={place.name}
            disabled={pending}
            style={[styles.button, checked && styles.selected]}
            onPress={() => {
              setExcluded((current) =>
                checked ? [...current, place.id] : current.filter((id) => id !== place.id),
              );
              setPlans([]);
              setError('');
            }}
          >
            <Text style={styles.buttonText}>
              {checked ? '✓ ' : ''}
              {place.name}
            </Text>
          </Pressable>
        );
      })}
      {(placeIds.length > 0 || hasUntimed) && (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={generate}
          style={[styles.button, !plan && styles.primary]}
        >
          <Text style={plan ? styles.buttonText : styles.primaryText}>Generate options</Text>
        </Pressable>
      )}
      {plan && (
        <>
          <View style={styles.wrap}>
            {plans.map((option, index) => (
              <Pressable
                key={option.strategy}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === index, disabled: pending }}
                disabled={pending}
                onPress={() => {
                  setSelected(index);
                  setError('');
                }}
                style={[styles.button, selected === index && styles.selected]}
              >
                <Text style={styles.buttonText}>{optionNames[option.strategy]}</Text>
              </Pressable>
            ))}
          </View>
          {[...new Set(plan.stops.map((stop) => stop.day))].map((day) => (
            <View key={day} style={styles.previewDay}>
              <Text accessibilityRole="header" style={styles.text}>
                {itineraryDayLabel(view.trip.startDate, day)}
              </Text>
              {plan.stops
                .filter((stop) => stop.day === day)
                .map((stop) => {
                  const previous = stop.id ? existing.get(stop.id) : undefined;
                  const name =
                    previous?.place?.name ??
                    stop.title ??
                    names.get(stop.placeId ?? '') ??
                    'Place unavailable';
                  return (
                    <View key={stop.id ?? stop.placeId}>
                      <Text style={styles.muted}>
                        {stop.startTime
                          ? formatTimeRange(stop.startTime, stop.visitMinutes)
                          : 'Time to be set'}{' '}
                        · {name}
                        {stop.isFixed ? ' · Fixed' : stop.isRequired ? ' · Must-do' : ''}
                      </Text>
                      <HoursWarning stop={stop} hours={view.trip.dailyWindow} />
                    </View>
                  );
                })}
            </View>
          ))}
          {plan.stops.some((stop) => stop.isRequired && !stop.startTime) && (
            <Text style={styles.error}>
              Some must-do activities still need a time. They’ll stay on the itinerary.
            </Text>
          )}
          {plan.unscheduledPlaceIds.length > 0 && (
            <Text style={styles.muted}>
              Couldn’t fit: {plan.unscheduledPlaceIds.map((id) => names.get(id)).join(', ')}.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pending, busy: pending }}
            disabled={pending}
            style={[styles.button, styles.primary, pending && styles.disabled]}
            onPress={async () => {
              setError('');
              const failure = await onApply(placeIds, plan.strategy);
              if (failure) setError(failure);
            }}
          >
            <Text style={styles.primaryText}>{pending ? 'Saving…' : 'Use this itinerary'}</Text>
          </Pressable>
        </>
      )}
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
