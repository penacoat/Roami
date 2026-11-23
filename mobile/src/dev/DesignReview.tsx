import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { callApi, getApiMode } from '../api';
import { AuthScreen } from '../auth/AuthScreens';
import { RecommendationsScreen } from '../components/recommendations/recommendationsScreen';
import { RoamiLoading } from '../design/RoamingRibbon';
import { fonts, palette, type } from '../design/tokens';
import { MapScreen } from '../screens/MapScreen';
import { SavedPlacesScreen } from '../screens/SavedPlacesScreen';
import { ItinerariesScreen } from '../screens/ItinerariesScreen';
import { ItineraryScreen } from '../screens/ItineraryScreen';
import { TripCreationScreen } from '../screens/TripCreationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const pages = [
  'Sign in',
  'Create account',
  'Loading',
  'Explore',
  'Postcards',
  'Itineraries',
  'Saved',
  'Profile',
] as const;
type Page = (typeof pages)[number] | 'Itinerary' | 'New itinerary';
const tabs = [
  ['Explore', 'compass-outline'],
  ['Postcards', 'mail-outline'],
  ['Itineraries', 'map-outline'],
  ['Saved', 'bookmark-outline'],
  ['Profile', 'person-outline'],
] as const;
let prepared: Promise<void> | undefined;
function prepareReview() {
  if (getApiMode() !== 'fixtures') return Promise.reject(new Error('Review requires sample data.'));
  prepared ??= (async () => {
    await callApi('savePlace', { placeId: 'p-pike', recommendationId: 'r3' });
    await callApi('savePlace', { placeId: 'p-kerry', recommendationId: 'r2' });
    await callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r1' });
    await callApi('savePlace', { placeId: 'p-jazz', recommendationId: 'r8' });
    const { trips } = await callApi('listTrips', {});
    if (trips.length) return;
    const { trip } = await callApi('createTrip', {
      city: 'Seattle',
      startDate: '2026-12-05',
      endDate: '2026-12-06',
      dailyWindow: { start: '09:00', end: '20:00' },
    });
    const first = await callApi('addStop', {
      tripId: trip.trip.id,
      placeId: 'p-pike',
      recommendationIds: ['r3'],
      day: 1,
      visitMinutes: 60,
      startTime: '10:00',
      expectedRevision: trip.trip.revision,
    });
    await callApi('addStop', {
      tripId: trip.trip.id,
      placeId: 'p-kerry',
      recommendationIds: ['r2'],
      day: 1,
      visitMinutes: 60,
      startTime: '14:00',
      expectedRevision: first.trip.trip.revision,
    });
  })().catch((error) => {
    prepared = undefined;
    throw error;
  });
  return prepared;
}

/** Explicit development-only review, with isolated fixtures and inert auth forms. */
export function DesignReview() {
  const { height } = useWindowDimensions();
  const [page, setPage] = useState<Page>('Sign in');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [placeRequest, setPlaceRequest] = useState<{ placeId?: string; recommendationId?: string }>(
    {},
  );
  const [tripId, setTripId] = useState('');
  useEffect(() => {
    prepareReview()
      .then(() => setReady(true))
      .catch((failure: Error) => setError(failure.message));
  }, []);
  const openPlace = (placeId: string, recommendationId?: string) => {
    setPlaceRequest({ placeId, recommendationId });
    setPage('Explore');
  };
  const showTabs = !['Sign in', 'Create account', 'Loading'].includes(page);
  function content() {
    switch (page) {
      case 'Sign in':
        return <AuthScreen key="signIn" previewMode="signIn" />;
      case 'Create account':
        return <AuthScreen key="signUp" previewMode="signUp" />;
      case 'Loading':
        return <RoamiLoading />;
      case 'Explore':
        return (
          <MapScreen
            requestedPlaceId={placeRequest.placeId}
            requestedRecommendationId={placeRequest.recommendationId}
            onPlaceRequestHandled={() => setPlaceRequest({})}
          />
        );
      case 'Postcards':
        return <RecommendationsScreen onOpenPlace={openPlace} />;
      case 'Saved':
        return (
          <SavedPlacesScreen
            refreshKey={0}
            onExplore={() => setPage('Explore')}
            onOpenPlace={openPlace}
          />
        );
      case 'Itineraries':
        return (
          <ItinerariesScreen
            refreshKey={0}
            onCreate={() => setPage('New itinerary')}
            onOpen={(id) => {
              setTripId(id);
              setPage('Itinerary');
            }}
          />
        );
      case 'Itinerary':
        return (
          <ItineraryScreen
            tripId={tripId}
            onBack={() => setPage('Itineraries')}
            onExplore={() => setPage('Explore')}
            onOpenPlace={openPlace}
          />
        );
      case 'New itinerary':
        return (
          <TripCreationScreen
            onBack={() => setPage('Itineraries')}
            onCreated={(id) => {
              setTripId(id);
              setPage('Itinerary');
            }}
          />
        );
      case 'Profile':
        return <ProfileScreen onSignOut={async () => setPage('Sign in')} />;
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.review}>
      <Text style={styles.title}>Roami · local design review</Text>
      <Text style={styles.note}>
        Sample content only. Account forms do not send requests. Test the native map in Expo Go.
      </Text>
      <View style={styles.choices}>
        {pages.map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: page === label }}
            onPress={() => setPage(label)}
            style={[styles.choice, page === label && styles.activeChoice]}
          >
            <Text style={[styles.choiceText, page === label && { color: palette.card }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.phone, { height: Math.min(760, Math.max(520, height - 185)) }]}>
        {!ready ? (
          error ? (
            <Text style={styles.note}>{error}</Text>
          ) : (
            <ActivityIndicator accessibilityLabel="Preparing sample review" />
          )
        ) : (
          <View key={page} style={styles.page}>
            {content()}
          </View>
        )}
        {ready && showTabs && (
          <View style={styles.tabs}>
            {tabs.map(([label, icon]) => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: page === label }}
                onPress={() => setPage(label)}
                style={styles.tab}
              >
                <View style={[styles.icon, page === label && { backgroundColor: '#EEDFA4' }]}>
                  <Ionicons
                    name={icon}
                    size={23}
                    color={page === label ? palette.primary : palette.muted}
                  />
                </View>
                <Text style={styles.tabLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  review: { flexGrow: 1, alignItems: 'center', backgroundColor: '#E6E3DB', padding: 24, gap: 12 },
  title: { ...type.heading, color: palette.navy },
  note: { ...type.caption, color: palette.muted, textAlign: 'center', maxWidth: 620 },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    maxWidth: 940,
  },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#B8B8AE',
    paddingHorizontal: 12,
  },
  activeChoice: { backgroundColor: palette.navy, borderColor: palette.navy },
  choiceText: { ...type.action, color: palette.navy },
  phone: {
    width: 390,
    maxWidth: '100%',
    height: 760,
    backgroundColor: palette.paper,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B8B8AE',
  },
  page: { flex: 1, minHeight: 0 },
  tabs: {
    height: 68,
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { width: 48, height: 28, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: palette.primary },
});
