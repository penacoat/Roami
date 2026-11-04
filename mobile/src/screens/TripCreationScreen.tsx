// Adapted from Athena Bao’s trip creation screen, origin/setup-ci at f83515c.
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import type { Trip } from '@roami/shared';
import { callApi, getApiMode } from '../api';
import { TripCalendar } from '../trips/TripCalendar';
import { formatDate, tripDays, validateTripDraft, type TripDraft } from '../trips/tripDraft';
import { tripTheme as theme } from '../trips/tripTheme';

const initialDraft: TripDraft = {
  city: '',
  startDate: '',
  endDate: '',
  dayStart: '09:00',
  dayEnd: '21:00',
};
const destinations = ['Seattle', 'Portland', 'San Francisco'];

interface Props {
  onSignOut: () => Promise<void>;
}

export function TripCreationScreen({ onSignOut }: Props) {
  const [draft, setDraft] = useState<TripDraft>(initialDraft);
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const busy = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const days = draft.startDate && draft.endDate ? tripDays(draft.startDate, draft.endDate) : 0;

  function update(values: Partial<TripDraft>) {
    setDraft((current) => ({ ...current, ...values }));
    setError('');
  }

  async function createTrip() {
    if (busy.current) return;
    Keyboard.dismiss();
    const validation = validateTripDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await callApi('createTrip', {
        city: draft.city.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        dailyWindow: { start: draft.dayStart, end: draft.dayEnd },
      });
      setCreatedTrip(result.trip.trip);
      scroll.current?.scrollTo({ y: 0, animated: false });
    } catch {
      setError('We couldn’t save your trip. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (busy.current) return;
    busy.current = true;
    setSigningOut(true);
    setError('');
    try {
      await onSignOut();
    } catch {
      setError('Couldn’t sign out. Please try again.');
    } finally {
      busy.current = false;
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.wordmark}>
            <View accessible={false} style={styles.globe}>
              <View style={styles.globeMeridian} />
              <View style={styles.globeEquator} />
            </View>
            <Text style={styles.brand}>ROAMI</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={handleSignOut}
            disabled={saving || signingOut}
            style={styles.signOut}
          >
            <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {createdTrip ? (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <Text style={styles.stampText}>
                  TRIP{'\n'}BOOK{'\n'}✓
                </Text>
              </View>
              <Text style={styles.eyebrow}>TRIP CREATED</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {createdTrip.city}
              </Text>
              <View style={styles.postcard}>
                <View accessible={false} style={styles.postcardEdge}>
                  {Array.from({ length: 16 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.postcardStripe,
                        { backgroundColor: index % 2 ? theme.accent : theme.ink },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.dateLabel}>TRIP DETAILS</Text>
                <Text style={styles.cardTitle}>{createdTrip.city}</Text>
                <Text style={styles.summaryText}>
                  {formatDate(createdTrip.startDate)} – {formatDate(createdTrip.endDate)}
                </Text>
                <View style={styles.divider} />
                <Text style={styles.summaryText}>
                  {tripDays(createdTrip.startDate, createdTrip.endDate)}{' '}
                  {createdTrip.startDate === createdTrip.endDate ? 'day' : 'days'} to explore
                </Text>
                <Text style={styles.summaryText}>
                  Daily hours · {createdTrip.dailyWindow.start}–{createdTrip.dailyWindow.end}
                </Text>
              </View>
              <Text style={styles.note}>
                {getApiMode() === 'fixtures' ? 'Trip created.' : 'Trip saved.'} No places added yet.
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                style={styles.primary}
                disabled={signingOut}
                onPress={() => {
                  setCreatedTrip(null);
                  setDraft(initialDraft);
                  setError('');
                }}
              >
                <Text style={styles.primaryText}>Create another trip</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.intro}>
                <Text style={styles.eyebrow}>NEW TRIP</Text>
                <View style={styles.heroRow}>
                  <View style={styles.flex}>
                    <Text accessibilityRole="header" style={styles.title}>
                      Build a trip
                    </Text>
                    <Text style={styles.subtitle}>
                      Choose your destination, dates, and daily hours.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionNumber}>01 · THE DESTINATION</Text>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Where are you headed?
                </Text>
                <Text style={styles.label}>City or destination</Text>
                <TextInput
                  accessibilityLabel="City or destination"
                  style={styles.input}
                  placeholder="City name"
                  placeholderTextColor={theme.muted}
                  value={draft.city}
                  onChangeText={(city) => update({ city })}
                  autoCapitalize="words"
                  maxLength={100}
                  returnKeyType="done"
                  editable={!saving && !signingOut}
                />
                <Text style={styles.helper}>Suggestions</Text>
                <View style={styles.chips}>
                  {destinations.map((city) => (
                    <Pressable
                      key={city}
                      accessibilityRole="button"
                      accessibilityState={{ selected: draft.city === city }}
                      disabled={saving || signingOut}
                      onPress={() => update({ city })}
                      style={[styles.chip, draft.city === city && styles.activeChip]}
                    >
                      <Text style={[styles.chipText, draft.city === city && styles.activeChipText]}>
                        {city}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.card} pointerEvents={saving || signingOut ? 'none' : 'auto'}>
                <Text style={styles.sectionNumber}>02 · THE DATES</Text>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Travel dates
                </Text>
                <View style={styles.dateRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateLabel}>DEPARTURE</Text>
                    <Text style={styles.dateValue}>
                      {draft.startDate ? formatDate(draft.startDate) : 'Choose a date'}
                    </Text>
                  </View>
                  <Text style={styles.dateArrow}>→</Text>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateLabel}>RETURN</Text>
                    <Text style={styles.dateValue}>
                      {draft.endDate ? formatDate(draft.endDate) : 'Choose a date'}
                    </Text>
                  </View>
                </View>
                <TripCalendar
                  startDate={draft.startDate}
                  endDate={draft.endDate}
                  onChange={(startDate, endDate) => update({ startDate, endDate })}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionNumber}>03 · DAILY HOURS</Text>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  Planning hours
                </Text>
                <Text style={styles.helper}>Choose when each day starts and ends.</Text>
                <View style={styles.timeRow}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Start of day</Text>
                    <TextInput
                      accessibilityLabel="Start of day, 24-hour time"
                      style={styles.input}
                      value={draft.dayStart}
                      onChangeText={(dayStart) => update({ dayStart })}
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      autoCorrect={false}
                      editable={!saving && !signingOut}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.label}>End of day</Text>
                    <TextInput
                      accessibilityLabel="End of day, 24-hour time"
                      style={styles.input}
                      value={draft.dayEnd}
                      onChangeText={(dayEnd) => update({ dayEnd })}
                      placeholder="21:00"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                      autoCorrect={false}
                      editable={!saving && !signingOut}
                    />
                  </View>
                </View>
                <Text style={styles.helper}>24-hour time · 09:00 is 9 AM, 21:00 is 9 PM</Text>
              </View>
            </>
          )}
        </ScrollView>
        {!createdTrip && (
          <View style={styles.footer}>
            {days > 0 && (
              <Text style={styles.duration}>
                {days} {days === 1 ? 'day' : 'days'}
                {draft.city.trim() ? ` in ${draft.city.trim()}` : ''}
              </Text>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving || signingOut}
              accessibilityState={{ disabled: saving || signingOut, busy: saving }}
              onPress={createTrip}
              style={({ pressed }) => [
                styles.primary,
                (pressed || saving || signingOut) && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>Create trip</Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: theme.paper },
  header: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  globe: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeMeridian: {
    width: 11,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.ink,
  },
  globeEquator: { position: 'absolute', width: 19, height: 1, backgroundColor: theme.ink },
  brand: {
    color: theme.ink,
    fontFamily: theme.serif,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 2.7,
  },
  signOut: { minHeight: 44, justifyContent: 'center', paddingLeft: 16 },
  signOutText: { color: theme.muted, fontSize: 12, fontWeight: '500' },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 22,
  },
  intro: { gap: 14, paddingBottom: 8 },
  eyebrow: {
    color: theme.accent,
    fontFamily: theme.serif,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: {
    color: theme.text,
    fontFamily: theme.serif,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  subtitle: { color: theme.muted, fontSize: 13, fontWeight: '500', lineHeight: 21, marginTop: 9 },
  stampText: {
    color: theme.accent,
    fontFamily: theme.serif,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 15,
    textAlign: 'center',
  },
  sectionNumber: { color: theme.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  card: { paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 10 },
  cardTitle: {
    color: theme.text,
    fontFamily: theme.serif,
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 5,
  },
  label: { color: theme.text, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    minHeight: 49,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.card,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: theme.text,
    fontSize: 14,
  },
  helper: { color: theme.muted, fontSize: 12, fontWeight: '500', lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 24,
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.line,
  },
  activeChip: { backgroundColor: theme.ink, borderColor: theme.ink },
  chipText: { color: theme.text, fontSize: 12, fontWeight: '500' },
  activeChipText: { color: theme.card, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dateBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.card,
    padding: 12,
    gap: 8,
  },
  dateLabel: { color: theme.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  dateValue: { color: theme.ink, fontSize: 13, fontWeight: '600' },
  dateArrow: { color: theme.ink, fontSize: 18 },
  timeRow: { flexDirection: 'row', gap: 14 },
  footer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.paper,
  },
  duration: { color: theme.ink, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  primary: {
    minHeight: 50,
    padding: 14,
    borderRadius: 9,
    backgroundColor: theme.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.65 },
  note: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'center',
  },
  error: { color: '#A13D32', fontSize: 13, lineHeight: 20 },
  success: { gap: 22, paddingTop: 12 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  postcard: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 9,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
  },
  postcardEdge: {
    height: 7,
    flexDirection: 'row',
    gap: 9,
    overflow: 'hidden',
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: 12,
  },
  postcardStripe: { width: 22, height: 10, transform: [{ skewX: '-30deg' }], opacity: 0.8 },
  summaryText: { color: theme.text, fontSize: 14, lineHeight: 22 },
  divider: { height: 1, backgroundColor: theme.line, marginVertical: 4 },
});
