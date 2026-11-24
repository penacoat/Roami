import type { TripSummary } from '@roami/shared';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi } from '../api';
import { formatDate } from '../trips/tripDraft';
import { itineraryStyles as styles } from '../trips/itineraryStyles';
import { PageSignature } from '../design/PageSignature';

export function ItinerariesScreen({
  refreshKey,
  onOpen,
  onCreate,
}: {
  refreshKey: number;
  onOpen: (tripId: string) => void;
  onCreate: () => void;
}) {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingId, setPendingId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const busy = useRef(false);
  const loadKey = JSON.stringify([refreshKey, retry]);
  const loading = loadedKey !== loadKey;
  useEffect(() => {
    let active = true;
    callApi('listTrips', {})
      .then(({ trips }) => {
        if (active) {
          setTrips(trips);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load itineraries. Try again.');
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

  const current = trips.filter((trip) => !trip.archivedAt);
  const archived = trips.filter((trip) => trip.archivedAt);

  /** Moves a trip out of, or back into, the main list. Nothing about its plan changes. */
  async function setArchived(trip: TripSummary, archive: boolean) {
    if (busy.current) return;
    busy.current = true;
    setPendingId(trip.id);
    setNotice('');
    setActionError('');
    try {
      const { trip: updated } = await callApi('setTripArchived', {
        tripId: trip.id,
        archived: archive,
      });
      setTrips((items) =>
        items.map((item) =>
          item.id === trip.id
            ? { ...item, archivedAt: updated.trip.archivedAt ?? undefined }
            : item,
        ),
      );
      setNotice(
        archive
          ? `${trip.city} archived. Find it under Archived itineraries.`
          : `${trip.city} is back in your list.`,
      );
    } catch {
      setActionError(
        archive
          ? `Could not archive ${trip.city}. Try again.`
          : `Could not unarchive ${trip.city}. Try again.`,
      );
    } finally {
      busy.current = false;
      setPendingId('');
    }
  }

  function renderTrip(trip: TripSummary) {
    const isArchived = Boolean(trip.archivedAt);
    return (
      <View key={trip.id} style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open itinerary: ${trip.city}, ${formatDate(trip.startDate)}`}
          onPress={() => onOpen(trip.id)}
          style={styles.card}
        >
          <Text style={styles.heading}>{trip.city}</Text>
          <Text style={styles.muted}>
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          </Text>
          <Text style={styles.buttonText}>
            {trip.stopCount} {trip.stopCount === 1 ? 'stop' : 'stops'} · View itinerary →
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isArchived ? 'Unarchive' : 'Archive'} ${trip.city} itinerary`}
          disabled={Boolean(pendingId)}
          accessibilityState={{ disabled: Boolean(pendingId), busy: pendingId === trip.id }}
          onPress={() => void setArchived(trip, !isArchived)}
          style={[styles.button, { alignSelf: 'flex-start' }]}
        >
          <Text style={styles.buttonText}>
            {pendingId === trip.id ? 'Saving…' : isArchived ? 'Unarchive' : 'Archive'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        testID="itineraries-list"
        contentContainerStyle={styles.content}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (loading) return;
              setRefreshing(true);
              setRetry((value) => value + 1);
            }}
          />
        }
      >
        <PageSignature title="Itineraries" />
        <Pressable
          accessibilityRole="button"
          onPress={onCreate}
          style={[styles.button, styles.primary]}
        >
          <Text style={styles.primaryText}>New itinerary</Text>
        </Pressable>
        {notice !== '' && (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            {notice}
          </Text>
        )}
        {actionError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError}
          </Text>
        )}
        {!!error && (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setRetry((value) => value + 1)}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </>
        )}
        {loading && !refreshing ? (
          <ActivityIndicator accessibilityLabel="Loading itineraries" />
        ) : trips.length === 0 ? (
          !error && <Text style={styles.text}>No itineraries yet.</Text>
        ) : (
          <>
            {current.length === 0 ? (
              <Text style={styles.text}>No active itineraries.</Text>
            ) : (
              current.map(renderTrip)
            )}
            {archived.length > 0 && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showArchived }}
                  onPress={() => setShowArchived((value) => !value)}
                  style={[styles.button, { alignSelf: 'flex-start' }]}
                >
                  <Text style={styles.buttonText}>
                    {showArchived ? 'Hide' : 'Show'} archived itineraries ({archived.length})
                  </Text>
                </Pressable>
                {showArchived && archived.map(renderTrip)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
