import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { itineraryStyles as styles } from './itineraryStyles';
import { MIDNIGHT, formatMinutes } from './stopTime';
import { tripTheme as theme } from './tripTheme';

type Which = 'start' | 'end';

/** A Date on an arbitrary day at the given minutes after midnight, for the picker. */
function dateAt(minutes: number): Date {
  const date = new Date(2000, 0, 1, 0, 0, 0, 0);
  date.setHours(Math.floor(minutes / 60) % 24, minutes % 60);
  return date;
}

/**
 * Start and end times, each chosen from the native time wheel. Times are minutes
 * after midnight; an end of MIDNIGHT (1440) means the end of the day. Changing the
 * start keeps the visit the same length, so the end moves with it.
 */
export function TimeRangePicker({
  start,
  end,
  onChange,
  disabled = false,
  subject,
}: {
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  disabled?: boolean;
  /** Names what is being timed, for screen readers ("Jazz Alley"). */
  subject?: string;
}) {
  const [open, setOpen] = useState<Which | null>(null);
  const label = (which: Which) =>
    `${which === 'start' ? 'Start' : 'End'} time${subject ? ` for ${subject}` : ''}`;

  function pick(which: Which, event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setOpen(null); // Android shows a dialog that closes itself
    if (event.type !== 'set' || !date) return;
    const minutes = date.getHours() * 60 + date.getMinutes();
    if (which === 'start') {
      onChange(minutes, Math.min(minutes + (end - start), MIDNIGHT));
    } else {
      onChange(start, minutes === 0 ? MIDNIGHT : minutes);
    }
  }

  return (
    <View style={{ gap: 8 }}>
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
              onPress={() => setOpen(selected ? null : which)}
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
      {open && (
        <View style={{ gap: 4 }}>
          <DateTimePicker
            testID={`${open}-time-picker`}
            accessibilityLabel={label(open)}
            value={dateAt(open === 'start' ? start : end)}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minuteInterval={5}
            themeVariant="light"
            textColor={theme.ink}
            onChange={(event, date) => pick(open, event, date)}
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
      )}
    </View>
  );
}
