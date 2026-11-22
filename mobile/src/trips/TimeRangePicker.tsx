import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { isValidTime, minutesOfDay } from '../logic/trips';
import { itineraryStyles as styles } from './itineraryStyles';
import { MIDNIGHT, formatMinutes, timeFromMinutes } from './stopTime';
import { tripTheme as theme } from './tripTheme';

type Which = 'start' | 'end';
const planningRanges = [
  { label: 'Full day', start: 9 * 60, end: 21 * 60 },
  { label: 'Daytime', start: 9 * 60, end: 17 * 60 },
  { label: 'Afternoon & evening', start: 12 * 60, end: 21 * 60 },
];

/** A Date on an arbitrary day at the given minutes after midnight, for the picker. */
function dateAt(minutes: number): Date {
  const date = new Date(2000, 0, 1, 0, 0, 0, 0);
  date.setHours(Math.floor(minutes / 60) % 24, minutes % 60);
  return date;
}

/**
 * Times are minutes after midnight. Visit ranges can end at midnight and keep
 * their duration when the start changes. Trip hours keep the end when possible.
 */
export function TimeRangePicker({
  start,
  end,
  onChange,
  disabled = false,
  subject,
  planning = false,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
  /** Names what is being timed, for screen readers ("Jazz Alley"). */
  subject?: string;
  planning?: boolean;
}) {
  const [open, setOpen] = useState<Which | null>(null);
  const [typed, setTyped] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [duration, setDuration] = useState(end - start);
  const limit = planning ? MIDNIGHT - 1 : MIDNIGHT;
  const label = (which: Which) =>
    `${which === 'start' ? 'Start' : 'End'} time${subject ? ` for ${subject}` : ''}`;

  function selectTime(which: Which, minutes: number) {
    if (which === 'start') {
      const nextEnd =
        planning && end > minutes ? end : Math.min(minutes + (duration > 0 ? duration : 60), limit);
      onChange(minutes, nextEnd);
    } else {
      onChange(start, !planning && minutes === 0 ? MIDNIGHT : minutes);
    }
  }

  const shortcuts = planning
    ? planningRanges
    : [30, 60, 90].map((duration) => ({ label: `${duration} min`, start, end: start + duration }));

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.wrap}>
        {shortcuts.map((range) => {
          const selected = range.start === start && range.end === end;
          const unavailable = disabled || range.end > limit;
          return (
            <Pressable
              key={range.label}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: unavailable }}
              disabled={unavailable}
              onPress={() => {
                setOpen(null);
                onChange(range.start, range.end);
              }}
              style={[styles.button, selected && styles.selected, unavailable && styles.disabled]}
            >
              <Text style={styles.buttonText}>{range.label}</Text>
              {planning && (
                <Text style={styles.muted}>
                  {formatMinutes(range.start)} – {formatMinutes(range.end)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.wrap}>
        {(['start', 'end'] as const).map((which) => {
          const value = which === 'start' ? start : end;
          const selected = open === which;
          return (
            <Pressable
              key={which}
              accessibilityRole="button"
              accessibilityLabel={`${label(which)}, ${formatMinutes(value)}`}
              accessibilityState={{ expanded: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                setOpen(selected ? null : which);
                setTyped(timeFromMinutes(value % MIDNIGHT));
                setInvalid(false);
                setDuration(end - start);
              }}
              style={[
                styles.field,
                styles.input,
                styles.pickerField,
                selected && styles.selected,
                disabled && styles.disabled,
              ]}
            >
              <Text style={styles.muted}>{which === 'start' ? 'Start' : 'End'}</Text>
              <Text style={styles.pickerValue}>{formatMinutes(value)}</Text>
            </Pressable>
          );
        })}
      </View>
      {open && Platform.OS === 'web' ? (
        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel={label(open)}
            style={styles.input}
            placeholder="HH:mm"
            value={typed}
            maxLength={5}
            editable={!disabled}
            onChangeText={(value) => {
              setTyped(value);
              setInvalid(false);
            }}
          />
          {invalid && (
            <Text accessibilityRole="alert" style={styles.error}>
              Enter a time from 00:00 to 23:59.
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            style={styles.button}
            onPress={() => {
              if (!isValidTime(typed)) {
                setInvalid(true);
                return;
              }
              selectTime(open, minutesOfDay(typed));
              setOpen(null);
            }}
          >
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        open &&
        !disabled && (
          <View style={{ gap: 4 }}>
            <DateTimePicker
              testID={`${open}-time-picker`}
              accessibilityLabel={label(open)}
              value={dateAt(open === 'start' ? start : end)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant="light"
              textColor={theme.ink}
              onValueChange={(_, date) => {
                if (Platform.OS !== 'ios') setOpen(null);
                selectTime(open, date.getHours() * 60 + date.getMinutes());
              }}
              onDismiss={() => setOpen(null)}
            />
            {Platform.OS === 'ios' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Done choosing ${label(open).toLowerCase()}`}
                onPress={() => setOpen(null)}
                style={[styles.button, { alignSelf: 'flex-end' }]}
              >
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            )}
          </View>
        )
      )}
    </View>
  );
}
