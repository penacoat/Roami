import type { PlaceSummary, RecommendationView, SavedPlaceView } from '@roami/shared';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { callApi, getApiMode } from '../../api';
import { AddToItinerary } from './AddToItinerary';
import { colors } from './theme';

interface Props {
  place: PlaceSummary;
  saved: SavedPlaceView | undefined;
  pending: string;
  notice: string;
  saveFailed: boolean;
  onSave: (recommendationId?: string) => void;
  onUnsave: () => void;
  onClose: () => void;
}

/** Mount with key={place.id}; old requests cannot overwrite another place's details. */
export function PlaceDetails({
  place,
  saved,
  pending,
  notice,
  saveFailed,
  onSave,
  onUnsave,
  onClose,
}: Props) {
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [linkError, setLinkError] = useState('');
  const sampleData = getApiMode() === 'fixtures' || Boolean(process.env.EXPO_PUBLIC_EMULATOR_HOST);
  const sourceLinks = [
    ...new Set(
      recommendations
        .filter((item) => item.status === 'available')
        .flatMap((item) => item.sourceLinks),
    ),
  ].flatMap((value) => {
    try {
      const url = new URL(value);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        return [];
      return [{ url: value, host: url.hostname.replace(/^www\./, '') }];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;
    callApi('getPlace', { placeId: place.id })
      .then((result) => {
        if (active) setRecommendations(result.recommendations);
      })
      .catch(() => {
        if (active) setError('Recommendations could not load. Try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [place.id, retry]);

  return (
    <View style={styles.sheet}>
      <View style={styles.heading}>
        <View style={styles.titleGroup}>
          <Text style={styles.eyebrow}>{place.category.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {place.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close place details"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.link}>← Places</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hours}>
          {sampleData
            ? 'Hours not verified'
            : place.openingHours?.trim()
              ? `Reported hours · ${place.openingHours}`
              : 'Hours not provided'}
        </Text>
        {sourceLinks.map(({ url, host }) => (
          <Pressable
            key={url}
            accessibilityRole="link"
            accessibilityLabel={`Open source: ${host}`}
            style={styles.retry}
            onPress={() =>
              void Linking.openURL(url).catch(() =>
                setLinkError('Could not open the link. Try again.'),
              )
            }
          >
            <Text style={styles.link}>Source · {host} ↗</Text>
          </Pressable>
        ))}
        {!loading && !error && sourceLinks.length === 0 && (
          <Text style={styles.hours}>No source link provided.</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Unsave place' : 'Save place'}
          accessibilityHint={
            saved ? 'Remove this place and its recommendation sources from Saved.' : undefined
          }
          accessibilityState={{ disabled: Boolean(pending), busy: Boolean(pending) }}
          disabled={Boolean(pending)}
          onPress={() => (saved ? onUnsave() : onSave())}
          style={[styles.save, saved && styles.saved]}
        >
          <Text style={styles.saveText}>
            {pending || (saved ? 'Saved ✓ · Unsave' : 'Save place')}
          </Text>
        </Pressable>
        <AddToItinerary place={place} />
        {notice !== '' && (
          <Text
            accessibilityRole={saveFailed ? 'alert' : undefined}
            accessibilityLiveRegion="polite"
            style={styles.notice}
          >
            {notice}
          </Text>
        )}
        {loading && (
          <ActivityIndicator accessibilityLabel="Loading recommendations" color={colors.ink} />
        )}
        {error !== '' && (
          <View>
            <Text accessibilityRole="alert" style={styles.notice}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                setError('');
                setRetry((value) => value + 1);
              }}
              style={styles.retry}
            >
              <Text style={styles.link}>Retry recommendations</Text>
            </Pressable>
          </View>
        )}
        {!loading && error === '' && recommendations.length === 0 && (
          <Text style={styles.hours}>No recommendations yet.</Text>
        )}
        {recommendations.map((recommendation) => (
          <View key={recommendation.id} style={styles.postcard}>
            {recommendation.status === 'unavailable' ? (
              <Text style={styles.hours}>This recommendation is no longer available.</Text>
            ) : (
              <>
                <Text style={styles.author}>
                  {sampleData ? 'Sample recommendation ·' : 'Recommended by'}{' '}
                  {recommendation.author?.name ?? 'a traveler'}
                </Text>
                <Text style={styles.description}>{recommendation.description}</Text>
                {recommendation.tags.length > 0 && (
                  <Text style={styles.tags}>{recommendation.tags.join(' · ')}</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Save recommendation by ${recommendation.author?.name ?? 'a traveler'}`}
                  accessibilityState={{
                    disabled:
                      Boolean(pending) ||
                      saved?.recommendations.some((item) => item.id === recommendation.id) === true,
                  }}
                  disabled={
                    Boolean(pending) ||
                    saved?.recommendations.some((item) => item.id === recommendation.id)
                  }
                  onPress={() => onSave(recommendation.id)}
                  style={styles.retry}
                >
                  <Text style={styles.link}>
                    {saved?.recommendations.some((item) => item.id === recommendation.id)
                      ? 'Recommendation saved ✓'
                      : 'Save recommendation'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ))}
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
  sheet: {
    backgroundColor: colors.paper,
    flex: 1,
    minHeight: 0,
    paddingTop: 4,
  },
  heading: { flexDirection: 'row', paddingHorizontal: 20, alignItems: 'flex-start', gap: 10 },
  titleGroup: { flex: 1 },
  eyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 5,
  },
  title: {
    fontSize: 23,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: colors.ink,
  },
  close: { minWidth: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flexShrink: 1 },
  bodyContent: { padding: 20, paddingTop: 10, gap: 12 },
  hours: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  save: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  saved: { backgroundColor: '#4D685E' },
  saveText: { color: colors.white, fontWeight: '600' },
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
  tags: { color: colors.muted, fontSize: 12 },
  retry: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  notice: { color: colors.ink, fontSize: 13, lineHeight: 20 },
});
