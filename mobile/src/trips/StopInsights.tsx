import type { Trip, TripStopView } from '@roami/shared';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { outsidePlanningHours, type describeDayStops } from '../logic/stopDetails';
import { minutesOfDay } from '../logic/trips';
import { activityName, formatDuration } from './daySchedule';
import { itineraryStyles as styles } from './itineraryStyles';
import { formatTime } from './stopTime';

type Insights = ReturnType<typeof describeDayStops>[number];

export function HoursWarning({
  stop,
  hours,
}: {
  stop: Pick<TripStopView, 'startTime' | 'visitMinutes'>;
  hours: Trip['dailyWindow'];
}) {
  if (!outsidePlanningHours(stop, hours)) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      Outside daily planning hours ({formatTime(hours.start)} – {formatTime(hours.end)}).
    </Text>
  );
}

export function StopInsights({ entry, hours }: { entry: Insights; hours: Trip['dailyWindow'] }) {
  const { stop, previous, walking, straightLine } = entry;
  const cost = stop.cost ?? stop.place?.cost;
  const gap =
    previous?.startTime && stop.startTime
      ? minutesOfDay(stop.startTime) - minutesOfDay(previous.startTime) - previous.visitMinutes
      : null;
  const checks = [
    !stop.startTime && 'set a time',
    stop.place && !stop.place.openingHours && 'opening hours',
    !cost && 'cost',
    ...(stop.place?.missingFields
      .filter((field) => field !== 'openingHours' && field !== 'cost')
      .map((field) => field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()) ?? []),
    ...stop.warnings,
  ].filter(Boolean);
  return (
    <View style={{ gap: 4 }}>
      <HoursWarning stop={stop} hours={hours} />
      {previous && (
        <Text style={styles.muted}>
          {walking === null
            ? 'Walking time unknown'
            : `About ${walking === 0 ? '0 min' : formatDuration(walking)} walking`}
          {' from '}
          {activityName(previous)}
          {straightLine ? ' · straight-line estimate, check route' : ''}
        </Text>
      )}
      {cost && (
        <Text style={styles.text}>
          Cost · {cost.amount.toLocaleString()} {cost.currency}
        </Text>
      )}
      {walking !== null && gap !== null && gap < walking && (
        <Text style={styles.error}>
          Check travel time. The walking estimate exceeds the time between stops.
        </Text>
      )}
      {stop.place?.openingHours && (
        <Text style={styles.muted}>Listed hours · {stop.place.openingHours}</Text>
      )}
      {checks.length > 0 && (
        <Text style={styles.muted}>Still to check · {[...new Set(checks)].join(', ')}</Text>
      )}
    </View>
  );
}

export function CostEditor({
  stop,
  disabled,
  onSave,
}: {
  stop: TripStopView;
  disabled: boolean;
  onSave: (cost: TripStopView['cost']) => Promise<string | undefined>;
}) {
  const cost = stop.cost ?? stop.place?.cost;
  const [amount, setAmount] = useState(cost ? String(cost.amount) : '');
  const [currency, setCurrency] = useState(cost?.currency ?? '');
  const [error, setError] = useState('');

  async function save() {
    const numeric = Number(amount.trim().replace(',', '.'));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(amount.trim()) || !/^[A-Za-z]{3}$/.test(currency.trim())) {
      setError('Enter an amount and a currency code, such as 12.50 USD.');
      return;
    }
    setError((await onSave({ amount: numeric, currency: currency.trim().toUpperCase() })) ?? '');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.text}>Known cost</Text>
      <View style={styles.wrap}>
        <TextInput
          accessibilityLabel="Cost amount"
          placeholder="Amount"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          style={[styles.input, styles.field]}
          editable={!disabled}
        />
        <TextInput
          accessibilityLabel="Cost currency"
          placeholder="Currency (e.g. USD)"
          autoCapitalize="characters"
          value={currency}
          onChangeText={setCurrency}
          maxLength={3}
          style={[styles.input, styles.field]}
          editable={!disabled}
        />
      </View>
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.wrap}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          style={styles.button}
          onPress={() => void save()}
        >
          <Text style={styles.buttonText}>Save cost</Text>
        </Pressable>
        {stop.cost && (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            style={styles.button}
            onPress={async () => {
              const failure = await onSave(null);
              if (failure) setError(failure);
              else {
                setAmount(stop.place?.cost ? String(stop.place.cost.amount) : '');
                setCurrency(stop.place?.cost?.currency ?? '');
              }
            }}
          >
            <Text style={styles.buttonText}>Clear custom cost</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
