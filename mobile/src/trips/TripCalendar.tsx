import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dateKey } from './tripDraft';
import { tripTheme as theme } from './tripTheme';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export function TripCalendar({ startDate, endDate, onChange }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [choosingEnd, setChoosingEnd] = useState(false);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Math.ceil((offset + count) / 7) * 7;

  function select(key: string) {
    if (!choosingEnd || key < startDate) {
      onChange(key, '');
      setChoosingEnd(true);
    } else {
      onChange(startDate, key);
      setChoosingEnd(false);
    }
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.arrow}
          onPress={() => setMonth(new Date(year, monthIndex - 1, 1))}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.arrow}
          onPress={() => setMonth(new Date(year, monthIndex + 1, 1))}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <View key={`weekday-${index}`} style={styles.cell}><Text style={styles.weekday}>{day}</Text></View>
        ))}
        {Array.from({ length: cells }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > count) return <View key={index} style={styles.cell} />;
          const key = dateKey(new Date(year, monthIndex, day));
          const selected = key === startDate || key === endDate;
          const inRange = Boolean(startDate && endDate && key > startDate && key < endDate);
          return (
            <Pressable key={index} accessibilityRole="button"
              accessibilityLabel={new Date(year, monthIndex, day).toLocaleDateString('en-US', { dateStyle: 'full' })}
              accessibilityState={{ selected: selected || inRange }}
              onPress={() => select(key)}
              style={[styles.cell, inRange && styles.inRange, selected && styles.selected]}>
              <Text style={[styles.day, selected && styles.selectedText]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.hint}>
        {choosingEnd ? 'Now choose your return date. Tap the same day for a day trip.' : 'Tap a departure date, then a return date.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: 6, backgroundColor: theme.card, borderRadius: 9, borderWidth: 1, borderColor: theme.line, padding: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: theme.ink, fontSize: 30 },
  month: { color: theme.text, fontFamily: theme.serif, fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  day: { color: theme.text, fontSize: 15 },
  inRange: { backgroundColor: theme.butter },
  selected: { backgroundColor: theme.ink, borderRadius: 24 },
  selectedText: { color: '#FFFFFF', fontWeight: '700' },
  hint: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
