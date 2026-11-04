import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SavedPlaceView } from '@roami/shared';
import { callApi } from '../api';
import {
  notifySavedPlacesChanged,
  useSavedPlacesChangeVersion,
} from '../hooks/useSavedPlacesChanges';
import { colors } from './map/theme';

interface Props {
  refreshKey: number;
  onOpenPlace: (placeId: string) => void;
  onExplore: () => void;
}

export function SavedPlacesScreen({ refreshKey, onOpenPlace, onExplore }: Props) {
  const savedChanges = useSavedPlacesChangeVersion('saved');
  const [places, setPlaces] = useState<SavedPlaceView[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState('');
  const [removedName, setRemovedName] = useState('');
  const busy = useRef(false);
  const revision = useRef(0);
  const loadKey = JSON.stringify([refreshKey, refresh, savedChanges]);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let active = true;
    const currentRevision = revision.current;
    callApi('listSavedPlaces', {})
      .then(({ saved }) => {
        if (active && currentRevision === revision.current) {
          setPlaces(saved);
          setError('');
          setRemovedName('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load saved places. Please try again.');
      })
      .finally(() => {
        if (active) setLoadedKey(loadKey);
      });
    return () => {
      active = false;
    };
  }, [loadKey]);

  async function unsave(item: SavedPlaceView) {
    if (busy.current) return;
    busy.current = true;
    revision.current += 1;
    setPending(item.place.id);
    setError('');
    setRemovedName('');
    try {
      await callApi('removeSavedPlace', { placeId: item.place.id });
      revision.current += 1;
      setPlaces((current) => current.filter((entry) => entry.place.id !== item.place.id));
      notifySavedPlacesChanged('saved');
      setRemovedName(item.place.name);
    } catch {
      setError('Could not unsave this place. Please try again.');
    } finally {
      busy.current = false;
      setPending('');
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.heading}>
        <Text style={styles.brand}>ROAMI</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Saved places
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading || Boolean(pending)}
          onPress={() => setRefresh((value) => value + 1)}
          style={styles.action}
        >
          <Text style={styles.link}>{error ? 'Retry saved places' : 'Refresh saved places'}</Text>
        </Pressable>
        {error !== '' && !loading && (
          <Text accessibilityRole="alert" style={styles.message}>
            {error}
          </Text>
        )}
        {removedName !== '' && !loading && (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {removedName} removed. You can save it again in Explore.
          </Text>
        )}
      </View>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading saved places" color={colors.primary} />
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.place.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            error ? undefined : (
              <View style={styles.empty}>
                <Text style={styles.message}>Save a place in Explore to find it here.</Text>
                <Pressable accessibilityRole="button" onPress={onExplore} style={styles.primary}>
                  <Text style={styles.primaryText}>Explore places</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open saved place: ${item.place.name}`}
                onPress={() => onOpenPlace(item.place.id)}
                style={styles.open}
              >
                <Text style={styles.category}>{item.place.category}</Text>
                <Text style={styles.placeName}>{item.place.name}</Text>
                <Text style={styles.link}>See place →</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unsave ${item.place.name}`}
                accessibilityHint="Removes this place and its recommendation sources from Saved."
                disabled={Boolean(pending)}
                accessibilityState={{ disabled: Boolean(pending), busy: pending === item.place.id }}
                onPress={() => void unsave(item)}
                style={styles.action}
              >
                <Text style={styles.link}>
                  {pending === item.place.id ? 'Removing…' : 'Unsave'}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  heading: { paddingHorizontal: 20, paddingTop: 16 },
  brand: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: '700' },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: 5,
  },
  list: { padding: 20, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 16,
  },
  open: { gap: 6 },
  category: { color: colors.red, fontSize: 12 },
  placeName: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  empty: { gap: 16 },
  primary: {
    backgroundColor: colors.primary,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '600' },
});
