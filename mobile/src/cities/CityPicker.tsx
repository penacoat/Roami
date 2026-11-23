import type { CityLocation } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { palette, type } from '../design/tokens';
import { cityLabel } from './CityProvider';
import { currentCity } from './currentCity';
import { ActionIcon } from '../design/ActionIcon';

export function CityPicker({
  current,
  onSelect,
  onClose,
}: {
  current: CityLocation;
  onSelect: (city: CityLocation) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locationRequest = useRef(0);
  const locationBusy = useRef(false);
  useEffect(
    () => () => {
      locationRequest.current += 1;
    },
    [],
  );
  const [result, setResult] = useState<{
    key: string;
    cities: CityLocation[];
    error: string;
  } | null>(null);
  const text = query.trim();
  const key = `${text}:${retry}`;
  const ready = result?.key === key;
  useEffect(() => {
    if (text.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      callApi('searchCities', { query: text })
        .then(({ cities }) => {
          if (active) setResult({ key, cities, error: '' });
        })
        .catch(() => {
          if (active)
            setResult({
              key,
              cities: [],
              error: 'City search is unavailable. Check your connection and retry.',
            });
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, text]);
  function choose(city: CityLocation) {
    locationRequest.current += 1;
    Keyboard.dismiss();
    onSelect(city);
    onClose();
  }
  function close() {
    locationRequest.current += 1;
    onClose();
  }
  async function locate() {
    if (locationBusy.current) return;
    const request = ++locationRequest.current;
    locationBusy.current = true;
    setLocating(true);
    setLocationError('');
    Keyboard.dismiss();
    try {
      const city = await currentCity();
      if (request === locationRequest.current) choose(city);
    } catch (error) {
      if (request === locationRequest.current)
        setLocationError(
          error instanceof Error
            ? error.message
            : 'Could not find your location. Search for a city.',
        );
    } finally {
      if (request === locationRequest.current) {
        locationBusy.current = false;
        setLocating(false);
      }
    }
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Choose a city
          </Text>
          <Pressable accessibilityRole="button" onPress={close} style={styles.close}>
            <Text style={styles.action}>Cancel</Text>
          </Pressable>
        </View>
        <TextInput
          autoFocus
          accessibilityLabel="City name"
          placeholder="City, region or country"
          value={query}
          onChangeText={(value) => {
            locationRequest.current += 1;
            locationBusy.current = false;
            setLocating(false);
            setLocationError('');
            setQuery(value);
          }}
          maxLength={100}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
          style={styles.input}
        />
        {Platform.OS !== 'web' && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use current location"
              accessibilityState={{ busy: locating, disabled: locating }}
              disabled={locating}
              onPress={() => void locate()}
              style={styles.location}
            >
              {locating ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <ActionIcon name="location" />
              )}
              <Text style={styles.action}>
                {locating ? 'Finding your city…' : 'Use current location'}
              </Text>
            </Pressable>
            {!!locationError && (
              <Text accessibilityRole="alert" style={styles.hint}>
                {locationError}
              </Text>
            )}
          </>
        )}
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {text.length < 2 ? (
            <>
              <Text style={styles.hint}>Type at least two letters to find a city.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select city: ${cityLabel(current)}`}
                onPress={() => choose(current)}
                style={styles.option}
              >
                <Text style={styles.action}>{cityLabel(current)}</Text>
                <Text style={styles.hint}>Current city</Text>
              </Pressable>
            </>
          ) : !ready ? (
            <ActivityIndicator
              accessibilityLabel="Searching cities"
              style={styles.hint}
              color={palette.primary}
            />
          ) : result.error ? (
            <>
              <Text accessibilityRole="alert" style={styles.hint}>
                {result.error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetry((value) => value + 1)}
                style={styles.option}
              >
                <Text style={styles.action}>Retry city search</Text>
              </Pressable>
            </>
          ) : result.cities.length === 0 ? (
            <Text accessibilityRole="alert" style={styles.hint}>
              No matching city found. Check the spelling or add a region or country.
            </Text>
          ) : (
            result.cities.map((city) => (
              <Pressable
                key={city.id}
                accessibilityRole="button"
                accessibilityLabel={`Select city: ${cityLabel(city)}`}
                onPress={() => choose(city)}
                style={styles.option}
              >
                <Text style={styles.action}>{city.name}</Text>
                <Text style={styles.hint}>
                  {[city.region, city.country].filter(Boolean).join(', ')}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        <Text style={styles.credit}>City data: GeoNames via Open-Meteo</Text>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  location: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  screen: { flex: 1, backgroundColor: palette.paper, padding: 20, gap: 12 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.heading, color: palette.ink },
  action: { ...type.action, color: palette.primary },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  input: {
    ...type.body,
    color: palette.ink,
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: palette.card,
  },
  option: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  hint: { ...type.caption, color: palette.muted, paddingVertical: 4 },
  credit: { ...type.caption, color: palette.muted, marginTop: 8 },
});
