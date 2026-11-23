import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SavedPlaceView, TripSummary } from '@roami/shared';
import { callApi } from '../api';
import { buttonOutline } from '../components/buttonStyles';
import { PlaceJournal } from '../components/PlaceJournal';
import { AddToItinerary } from '../components/AddToItinerary';
import { placeActionStyles } from '../components/placeActionStyles';
import { SavedNote } from '../components/SavedNote';
import {
  notifySavedPlacesChanged,
  useSavedPlacesChangeVersion,
} from '../hooks/useSavedPlacesChanges';
import { colors } from './map/theme';
import { itineraryDayLabel } from '../trips/itineraryDayLabel';
import { formatDate } from '../trips/tripDraft';
import { PageSignature } from '../design/PageSignature';
import { type } from '../design/tokens';

interface Props {
  refreshKey: number;
  onOpenPlace: (placeId: string) => void;
  onExplore: () => void;
}

export function SavedPlacesScreen({ refreshKey, onOpenPlace, onExplore }: Props) {
  const savedChanges = useSavedPlacesChangeVersion('saved');
  const [journalOpen, setJournalOpen] = useState(false);
  const [places, setPlaces] = useState<SavedPlaceView[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState('');
  const [removed, setRemoved] = useState<SavedPlaceView | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [scheduleError, setScheduleError] = useState(false);
  const [scheduleRefresh, setScheduleRefresh] = useState(0);
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
          setRemoved(null);
        }
      })
      .catch(() => {
        if (active) setError('Could not load saved places. Please try again.');
      })
      .finally(() => {
        if (active) {
          setLoadedKey(loadKey);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loadKey]);

  useEffect(() => {
    let active = true;
    callApi('listTrips', { includeScheduledPlaces: true })
      .then(({ trips }) => {
        if (!active) return;
        setTrips(trips.filter((trip) => !trip.archivedAt));
        setScheduleError(false);
      })
      .catch(() => {
        if (active) setScheduleError(true);
      });
    return () => {
      active = false;
    };
  }, [refreshKey, refresh, scheduleRefresh]);

  function pullToRefresh() {
    if (loading || busy.current) return;
    setRefreshing(true);
    setRefresh((value) => value + 1);
  }

  async function unsave(item: SavedPlaceView) {
    if (busy.current) return;
    busy.current = true;
    revision.current += 1;
    setPending(item.place.id);
    setError('');
    setRemoved(null);
    try {
      await callApi('removeSavedPlace', { placeId: item.place.id });
      revision.current += 1;
      setPlaces((current) => current.filter((entry) => entry.place.id !== item.place.id));
      notifySavedPlacesChanged('saved');
      setRemoved(item);
    } catch {
      setError('Could not unsave this place. Please try again.');
    } finally {
      busy.current = false;
      setPending('');
    }
  }

  /** Puts back the place that was just removed, with its note, date and sources. */
  async function undo() {
    if (!removed || busy.current) return;
    busy.current = true;
    revision.current += 1;
    setPending(removed.place.id);
    setError('');
    try {
      const { saved } = await callApi('restoreSavedPlace', {
        placeId: removed.place.id,
        recommendationIds: removed.recommendations.map((rec) => rec.id),
        personalNote: removed.personalNote,
        createdAt: removed.createdAt,
      });
      revision.current += 1;
      setPlaces((current) =>
        [saved, ...current.filter((entry) => entry.place.id !== saved.place.id)].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || a.place.id.localeCompare(b.place.id),
        ),
      );
      notifySavedPlacesChanged('saved');
      setRemoved(null);
    } catch {
      setError('Could not undo. Please try again.');
    } finally {
      busy.current = false;
      setPending('');
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.heading}>
        <PageSignature title="Saved" />
        {error !== '' && (
          <Pressable
            accessibilityRole="button"
            disabled={loading || Boolean(pending)}
            onPress={() => setRefresh((value) => value + 1)}
            style={styles.action}
          >
            <Text style={styles.link}>Retry saved places</Text>
          </Pressable>
        )}
        {error !== '' && !loading && (
          <Text accessibilityRole="alert" style={styles.message}>
            {error}
          </Text>
        )}
        {removed !== null && !loading && (
          <View accessibilityLiveRegion="polite" style={styles.undoRow}>
            <Text style={[styles.message, styles.undoText]}>{removed.place.name} removed.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo removing ${removed.place.name}`}
              disabled={Boolean(pending)}
              accessibilityState={{ disabled: Boolean(pending), busy: Boolean(pending) }}
              onPress={() => void undo()}
              style={[styles.action, styles.undoButton]}
            >
              <Text style={styles.link}>{pending ? 'Restoring…' : 'Undo'}</Text>
            </Pressable>
          </View>
        )}
        {scheduleError && (
          <Text style={styles.message}>Could not refresh itinerary locations.</Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: journalOpen }}
        onPress={() => setJournalOpen((value) => !value)}
        style={[styles.action, { marginHorizontal: 20 }]}
      >
        <Text style={styles.link}>
          {journalOpen ? 'Back to saved places' : 'Visits & rankings'}
        </Text>
      </Pressable>
      {journalOpen ? (
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              testID="saved-journal-refresh"
              refreshing={refreshing}
              onRefresh={pullToRefresh}
            />
          }
        >
          <PlaceJournal refreshKey={refreshKey + refresh} />
        </ScrollView>
      ) : loading && !refreshing ? (
        <ActivityIndicator accessibilityLabel="Loading saved places" color={colors.primary} />
      ) : (
        <FlatList
          testID="saved-places-list"
          refreshing={refreshing}
          onRefresh={pullToRefresh}
          alwaysBounceVertical
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
              {item.recommendations.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.recommendations.length} saved postcards about ${item.place.name}`}
                  onPress={() => onOpenPlace(item.place.id)}
                  style={styles.postcardCollection}
                >
                  <Text style={styles.link}>
                    {item.recommendations.length} saved{' '}
                    {item.recommendations.length === 1 ? 'postcard' : 'postcards'} →
                  </Text>
                  <Text style={styles.message} numberOfLines={2}>
                    {[
                      ...new Set(
                        item.recommendations.map(
                          (rec) => rec.author?.name ?? 'Unavailable postcard',
                        ),
                      ),
                    ].join(' · ')}
                  </Text>
                </Pressable>
              )}
              {trips.map((trip) => {
                const days = [
                  ...new Set(
                    trip.scheduledPlaces
                      ?.filter((stop) => stop.placeId === item.place.id)
                      .map((stop) => stop.day),
                  ),
                ].sort((a, b) => a - b);
                return days.map((day) => (
                  <Text key={`${trip.id}-${day}`} style={[styles.message, styles.schedule]}>
                    Scheduled in {trip.city} (trip starts {formatDate(trip.startDate)}) ·{' '}
                    {itineraryDayLabel(trip.startDate, day)}
                  </Text>
                ));
              })}
              <SavedNote
                placeId={item.place.id}
                placeName={item.place.name}
                note={item.personalNote}
                onSaved={(saved) =>
                  setPlaces((current) =>
                    current.map((entry) => (entry.place.id === saved.place.id ? saved : entry)),
                  )
                }
              />
              <View style={[placeActionStyles.row, { marginTop: 10 }]}>
                <AddToItinerary
                  compact
                  place={item.place}
                  recommendationIds={item.recommendations.map(
                    (recommendation) => recommendation.id,
                  )}
                  onChanged={() => setScheduleRefresh((value) => value + 1)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Unsave ${item.place.name}`}
                  accessibilityHint="Removes this place and its recommendation sources from Saved."
                  disabled={Boolean(pending)}
                  accessibilityState={{
                    disabled: Boolean(pending),
                    busy: pending === item.place.id,
                  }}
                  onPress={() => void unsave(item)}
                  style={[placeActionStyles.button, placeActionStyles.section]}
                >
                  <Text style={placeActionStyles.text}>
                    {pending === item.place.id ? 'Removing…' : 'Unsave'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  heading: { paddingHorizontal: 20, paddingTop: 8 },
  list: { padding: 20, gap: 12 },
  postcardCollection: {
    padding: 12,
    gap: 4,
    marginTop: 8,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: colors.border,
    borderRadius: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 16,
  },
  open: { ...buttonOutline, gap: 6, padding: 12 },
  category: { color: colors.red, fontSize: 12 },
  placeName: {
    ...type.heading,
    color: colors.ink,
  },
  action: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 10,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: { ...type.action, color: colors.primary },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  schedule: { marginTop: 8, color: colors.ink },
  undoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  undoText: { flexShrink: 1 },
  undoButton: { marginTop: 0 },
  empty: { gap: 16 },
  primary: {
    ...buttonOutline,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '600' },
});
