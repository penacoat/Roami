import type { PlaceSummary, RecommendationView, SavedPlaceView } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { callApi, getApiMode } from '../../api';
import { buttonOutline } from '../../components/buttonStyles';
import { VisitPlace } from '../../components/PlaceJournal';
import { AddToItinerary } from '../../components/AddToItinerary';
import { colors } from './theme';
import { fonts } from '../../design/tokens';
import { Bookmark } from '../../design/Bookmark';
import { PlacePhotos } from './PlacePhotos';
import { PlacePostcards, isWebLink } from './PlacePostcards';
import { hasCoordinates } from './mapUtils';
import { placeActionStyles } from '../../components/placeActionStyles';

interface Props {
  place: PlaceSummary;
  highlightedRecommendationId?: string;
  saved: SavedPlaceView | undefined;
  pending: string;
  notice: string;
  saveFailed: boolean;
  onSave: (recommendationId?: string) => void;
  onUnsave: () => void;
  onRemoveRecommendation: (id: string) => void;
}

/** Mount with key={place.id}; old requests cannot overwrite another place's details. */
export function PlaceDetails({
  place: initialPlace,
  highlightedRecommendationId,
  saved,
  pending,
  notice,
  saveFailed,
  onSave,
  onUnsave,
  onRemoveRecommendation,
}: Props) {
  const [place, setPlace] = useState(initialPlace);
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [linkError, setLinkError] = useState('');
  const highlighted = recommendations.find((item) => item.id === highlightedRecommendationId);
  const recommendationIds = [
    ...new Set([
      ...(saved?.recommendations.map((item) => item.id) ?? []),
      ...(highlighted ? [highlighted.id] : []),
    ]),
  ];
  const sampleData = getApiMode() === 'fixtures' || Boolean(process.env.EXPO_PUBLIC_EMULATOR_HOST);
  const website = place.website && isWebLink(place.website) ? place.website : null;
  const ticketUrl = place.ticketUrl && isWebLink(place.ticketUrl) ? place.ticketUrl : null;
  const hoursSource = place.openingHoursSource;
  const hoursDate = hoursSource && new Date(hoursSource.checkedAt + 'T12:00:00Z');
  const sourcedHours = Boolean(
    hoursSource && isWebLink(hoursSource.url) && hoursDate && Number.isFinite(hoursDate.getTime()),
  );
  function openLink(url: string) {
    setLinkError('');
    void Linking.openURL(url).catch(() => setLinkError('Could not open the link. Try again.'));
  }

  useEffect(() => {
    let active = true;
    callApi('getPlace', { placeId: initialPlace.id })
      .then((result) => {
        if (active) {
          setPlace(result.place);
          setRecommendations(result.recommendations);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Place details could not load. Try again.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [initialPlace.id, retry]);

  return (
    <View style={styles.sheet}>
      <ScrollView
        testID="place-details-list"
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (loading || refreshing) return;
              setRefreshing(true);
              setRetry((value) => value + 1);
            }}
          />
        }
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.eyebrow}>{place.category.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {place.name}
        </Text>
        <View style={placeActionStyles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Unsave place' : 'Save place'}
            accessibilityHint={
              saved ? 'Remove this place and its recommendation sources from Saved.' : undefined
            }
            accessibilityState={{ disabled: Boolean(pending), busy: Boolean(pending) }}
            disabled={Boolean(pending)}
            onPress={() => (saved ? onUnsave() : onSave())}
            style={[
              placeActionStyles.button,
              { borderRightWidth: 1, borderRightColor: colors.border },
              saved && placeActionStyles.active,
            ]}
          >
            <View style={styles.bookmarkLabel}>
              <Bookmark saved={Boolean(saved)} />
              <Text style={placeActionStyles.text}>{pending || (saved ? 'Unsave' : 'Save')}</Text>
            </View>
          </Pressable>
          {(!highlightedRecommendationId || (!loading && !error)) && (
            <AddToItinerary compact place={place} recommendationIds={recommendationIds} />
          )}
          <VisitPlace compact place={place} />
        </View>
        {notice !== '' && (
          <Text
            accessibilityRole={saveFailed ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={styles.notice}
          >
            {notice}
          </Text>
        )}
        <PlacePhotos photos={place.photos} name={place.name} />
        <View style={styles.facts}>
          <Text style={styles.hours}>
            {place.openingHours?.trim()
              ? sourcedHours
                ? place.openingHours
                : `${sampleData ? 'Sample hours' : 'Reported hours'} · ${place.openingHours}`
              : 'Hours not provided'}
          </Text>
          {place.openingHours?.trim() && sourcedHours && hoursSource && hoursDate && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Hours source for ${place.name}`}
              onPress={() => openLink(hoursSource.url)}
              style={styles.hoursSource}
            >
              <Text style={styles.hours}>
                Venue hours · checked{' '}
                {hoursDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}{' '}
                ↗
              </Text>
            </Pressable>
          )}
          {place.address?.trim() && place.address.trim() !== place.city?.trim() ? (
            <Text style={styles.hours}>{place.address.trim()}</Text>
          ) : null}
          <View style={styles.links}>
            {hasCoordinates(place) && (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Directions to ${place.name}`}
                style={styles.retry}
                onPress={() =>
                  openLink(
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`,
                  )
                }
              >
                <Text style={styles.link}>Directions ↗</Text>
              </Pressable>
            )}
            {website && (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Website for ${place.name}`}
                style={styles.retry}
                onPress={() => openLink(website)}
              >
                <Text style={styles.link}>Website ↗</Text>
              </Pressable>
            )}
            {ticketUrl && (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Tickets for ${place.name}`}
                style={styles.retry}
                onPress={() => openLink(ticketUrl)}
              >
                <Text style={styles.link}>Tickets ↗</Text>
              </Pressable>
            )}
          </View>
        </View>
        {saved?.personalNote?.trim() ? (
          <View style={styles.postcard}>
            <Text style={styles.author}>Your private note</Text>
            <Text style={styles.description}>{saved.personalNote}</Text>
          </View>
        ) : null}
        <PlacePostcards
          recommendations={recommendations}
          saved={saved?.recommendations ?? []}
          highlightedId={highlightedRecommendationId}
          loading={loading}
          error={error}
          pending={Boolean(pending)}
          sample={sampleData}
          onRetry={() => {
            setLoading(true);
            setError('');
            setRetry((value) => value + 1);
          }}
          onSave={onSave}
          onRemove={onRemoveRecommendation}
        />
        {place.id.startsWith('osm-') && (
          <Text style={styles.hours}>© OpenStreetMap contributors</Text>
        )}
        {linkError !== '' && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {linkError}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hoursSource: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  bookmarkLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  facts: { gap: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  sheet: {
    backgroundColor: colors.paper,
    flex: 1,
    minHeight: 0,
    paddingTop: 4,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    fontSize: 23,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  body: { flex: 1, minHeight: 0 },
  bodyContent: { padding: 16, paddingTop: 10, paddingBottom: 24, gap: 12 },
  hours: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  postcard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  author: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  description: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  retry: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  notice: { color: colors.ink, fontSize: 13, lineHeight: 20 },
});
