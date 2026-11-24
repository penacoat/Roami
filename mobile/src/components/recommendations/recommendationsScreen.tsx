import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CityLocation, RecommendationView } from '@roami/shared';
import { callApi } from '../../api';
import { useCity, nearCity } from '../../cities/CityProvider';
import { CitySelector } from '../../cities/CitySelector';
import { buttonOutline } from '../buttonStyles';
import { PostcardRecommendation } from './postcardRecommendation';
import { PageSignature } from '../../design/PageSignature';
import { palette, type } from '../../design/tokens';

function belongsToCity(item: RecommendationView, city: CityLocation) {
  return city.cityId ? item.place.cityId === city.cityId : nearCity(item.place, city);
}

export function RecommendationsScreen({
  onOpenPlace,
}: {
  onOpenPlace: (placeId: string, recommendationId: string) => void;
}) {
  const { city, setCity } = useCity();
  const [followingOnly, setFollowingOnly] = useState(false);
  const [items, setRecommendations] = useState<RecommendationView[]>([]);
  const [itemsKey, setItemsKey] = useState('');
  const cityKey = `${city.id}:${city.cityId ?? ''}`;
  const loadKey = `${cityKey}:${followingOnly}`;
  const recommendations = itemsKey === loadKey ? items : [];
  const [loadedKey, setLoadedKey] = useState('');
  const loading = loadedKey !== loadKey;
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followingError, setFollowingError] = useState('');
  const [pendingFollowId, setPendingFollowId] = useState('');
  const [followingUserId, setFollowingUserId] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    callApi('getFollowing', {})
      .then(({ userId, userIds }) => {
        if (active) {
          setFollowingUserId(userId);
          setFollowingIds(userIds);
          setFollowingError('');
        }
      })
      .catch(() => {
        if (active) setFollowingError('Could not load following accounts. Try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    callApi('getFeed', {
      city: city.name,
      ...(city.cityId && { cityId: city.cityId }),
      ...(followingOnly && { followingOnly: true }),
    })
      .then(({ items, nextCursor: cursor }) => {
        if (active) {
          setRecommendations(
            items.filter((item) => item.status === 'available' && belongsToCity(item, city)),
          );
          setItemsKey(loadKey);
          setNextCursor(cursor ?? null);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('Could not load postcards. Check your connection and try again.');
      })
      .finally(() => {
        if (active) {
          setLoadedKey(loadKey);
          setRefreshing(false);
          setMoreError('');
          setLoadingMore(false);
        }
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [loadKey, refresh, city, followingOnly]);

  async function loadMore() {
    if (nextCursor === null || loadingMore || loading || refreshing) return;
    const started = generation.current;
    setLoadingMore(true);
    setMoreError('');
    try {
      const { items, nextCursor: cursor } = await callApi('getFeed', {
        city: city.name,
        ...(city.cityId && { cityId: city.cityId }),
        ...(followingOnly && { followingOnly: true }),
        cursor: nextCursor,
      });
      if (started !== generation.current) return;
      setRecommendations((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...items.filter(
            (item) =>
              item.status === 'available' && !seen.has(item.id) && belongsToCity(item, city),
          ),
        ];
      });
      setNextCursor(cursor ?? null);
    } catch {
      if (started === generation.current) {
        setMoreError('Could not load more postcards. Please try again.');
      }
    } finally {
      if (started === generation.current) setLoadingMore(false);
    }
  }

  async function toggleFollow(authorId: string, authorName: string) {
    setPendingFollowId(authorId);
    setFollowingError('');
    const isFollowing = followingIds.includes(authorId);
    try {
      if (isFollowing) {
        await callApi('unfollowUser', { userId: authorId });
        setFollowingIds((current) => current.filter((id) => id !== authorId));
        if (followingOnly) {
          setRecommendations((current) => current.filter((item) => item.author?.id !== authorId));
        }
      } else {
        await callApi('followUser', { userId: authorId });
        setFollowingIds((current) =>
          current.includes(authorId) ? current : [...current, authorId],
        );
      }
    } catch {
      setFollowingError(
        `Could not ${isFollowing ? 'unfollow' : 'follow'} ${authorName}. Try again.`,
      );
    } finally {
      setPendingFollowId('');
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        testID="postcards-list"
        style={styles.screen}
        contentContainerStyle={styles.content}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (loading || refreshing) return;
              setRefreshing(true);
              setRefresh((value) => value + 1);
            }}
          />
        }
      >
        <PageSignature title="Postcards" />
        <View style={styles.city}>
          <CitySelector city={city} onSelect={setCity} />
        </View>
        <View style={styles.feedTabs}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !followingOnly }}
            onPress={() => setFollowingOnly(false)}
            style={[styles.feedTab, !followingOnly && styles.feedTabSelected]}
          >
            <Text style={styles.action}>Postcards</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: followingOnly }}
            onPress={() => setFollowingOnly(true)}
            style={[styles.feedTab, followingOnly && styles.feedTabSelected]}
          >
            <Text style={styles.action}>Following</Text>
          </Pressable>
        </View>
        {followingOnly && (
          <Text accessibilityRole="header" style={styles.feedTitle}>
            Following · {city.name}
          </Text>
        )}
        {followingError !== '' && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {followingError}
          </Text>
        )}
        {error !== '' && (
          <Pressable
            accessibilityRole="button"
            disabled={loading || refreshing}
            onPress={() => {
              setError('');
              setRefresh((value) => value + 1);
            }}
            style={styles.refresh}
          >
            <Text style={styles.action}>Retry postcards</Text>
          </Pressable>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {error}
          </Text>
        )}
        {loading && !refreshing ? (
          <ActivityIndicator accessibilityLabel="Loading postcards" color="#283A70" />
        ) : recommendations.length === 0 ? (
          !error && (
            <Text style={styles.notice}>
              {followingOnly
                ? `No postcards from people you follow in ${city.name} yet.`
                : `No postcards for ${city.name} yet.`}
            </Text>
          )
        ) : (
          recommendations.map((rec) => (
            <View key={rec.id}>
              <PostcardRecommendation recommendation={rec} onOpenPlace={onOpenPlace} />
              {rec.author && rec.author.id !== followingUserId && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    followingIds.includes(rec.author.id)
                      ? `Unfollow ${rec.author.name}`
                      : `Follow ${rec.author.name}`
                  }
                  accessibilityState={{
                    disabled: pendingFollowId === rec.author.id,
                    busy: pendingFollowId === rec.author.id,
                  }}
                  disabled={pendingFollowId === rec.author.id}
                  onPress={() => void toggleFollow(rec.author!.id, rec.author!.name)}
                  style={styles.follow}
                >
                  <Text style={styles.action}>
                    {followingIds.includes(rec.author.id)
                      ? 'Following · Unfollow'
                      : `Follow ${rec.author.name}`}
                  </Text>
                </Pressable>
              )}
            </View>
          ))
        )}
        {!loading && !error && nextCursor !== null && (
          <>
            {moreError !== '' && (
              <Text accessibilityRole="alert" style={styles.notice}>
                {moreError}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={loadingMore}
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              onPress={() => void loadMore()}
              style={styles.more}
            >
              <Text style={styles.action}>
                {loadingMore
                  ? 'Loading…'
                  : moreError
                    ? 'Retry loading more'
                    : 'Load more postcards'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  content: {
    padding: 20,
  },
  city: { marginBottom: 12 },
  feedTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  feedTab: { ...buttonOutline, paddingHorizontal: 12, paddingVertical: 8 },
  feedTabSelected: { backgroundColor: '#EEDFA4' },
  feedTitle: { ...type.heading, color: palette.ink, marginBottom: 8 },
  notice: { ...type.body, color: palette.muted },
  refresh: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  follow: {
    ...buttonOutline,
    minHeight: 40,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 12,
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  more: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 24,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  action: { ...type.action, color: palette.primary },
});
