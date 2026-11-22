import type { Trip, TripStopView } from '@roami/shared';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { validateActivityOverlap } from '../logic/trips';
import { activityName } from './daySchedule';
import { itineraryStyles as styles } from './itineraryStyles';
import { HoursWarning } from './StopInsights';
import { formatTimeRange } from './stopTime';

export type StopChange = {
  before: TripStopView;
  after: TripStopView;
  revision: number;
  kind: 'move' | 'time';
  requireOpenSlot?: boolean;
};

export function StopChangePreview({
  change,
  hours,
  stops,
  disabled,
  onCancel,
  onApply,
}: {
  change: StopChange;
  hours: Trip['dailyWindow'];
  stops: TripStopView[];
  disabled: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  function summary(stop: TripStopView) {
    const time = stop.startTime
      ? formatTimeRange(stop.startTime, stop.visitMinutes)
      : 'Unscheduled';
    return `Day ${stop.day} · ${time}${change.kind === 'move' ? ` · Stop ${stop.order}` : ''}`;
  }
  const availability =
    change.kind === 'time' || change.before.day !== change.after.day
      ? validateActivityOverlap(stops, change.after, change.requireOpenSlot)
      : null;
  const conflict = availability && !availability.ok ? availability.error : '';
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!disabled) onCancel();
      }}
    >
      <View style={styles.confirmBackdrop}>
        <View accessibilityViewIsModal style={styles.confirmCard}>
          <Text accessibilityRole="header" style={styles.heading}>
            Preview change
          </Text>
          <Text style={styles.text}>{activityName(change.before)}</Text>
          <Text style={styles.muted}>Current · {summary(change.before)}</Text>
          <Text style={styles.text}>Proposed · {summary(change.after)}</Text>
          <HoursWarning stop={change.after} hours={hours} />
          {conflict && (
            <Text accessibilityRole="alert" style={styles.error}>
              {conflict}
            </Text>
          )}
          {change.before.isFixed && (
            <Text style={styles.error}>
              You’re changing a fixed activity. Check the reservation first.
            </Text>
          )}
          <View style={styles.wrap}>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              disabled={disabled}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancel change</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.primary, Boolean(conflict) && styles.disabled]}
              disabled={disabled || Boolean(conflict)}
              onPress={onApply}
            >
              <Text style={styles.primaryText}>Apply change</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
