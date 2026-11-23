import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RecommendationView } from '@roami/shared';
import { callApi } from '../../api';
import { buttonOutline } from '../buttonStyles';
import { PostcardRecommendation } from './postcardRecommendation';

export function RecommendationsScreen({ onOpenPlace }: { onOpenPlace: (placeId: string) => void }) {
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [followingOnly, setFollowingOnly] = useState(false);
  const [followingBusy, setFollowingBusy] = useState<string | null>(null);
  const [followError, setFollowError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      callApi('getFeed', { city: 'Seattle', followingOnly }),
      callApi('getFollowing', {}),
    ])
      .then(([{ items }, following]) => {
        if (active) {
          setRecommendations(items.filter((item) => item.status === 'available'));
          setFollowingIds(following.userIds);
          setCurrentUserId(following.userId);
        }
      })
      .catch(() => {
        if (active) setError('Could not load postcards. Check your connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh, followingOnly]);

  async function toggleFollow(userId: string) {
    if (followingBusy) return;
    const isFollowing = followingIds.includes(userId);
    setFollowingBusy(userId);
    setFollowError('');
    try {
      if (isFollowing) {
        await callApi('unfollowUser', { userId });
        setFollowingIds((ids) => ids.filter((id) => id !== userId));
        if (followingOnly) {
          setRecommendations((items) => items.filter((item) => item.author?.id !== userId));
        }
      } else {
        await callApi('followUser', { userId });
        setFollowingIds((ids) => [...ids, userId]);
      }
    } catch {
      setFollowError('Could not update following. Check your connection and try again.');
    } finally {
      setFollowingBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {followingOnly ? 'Following · Seattle' : 'Postcards from Seattle'}
        </Text>
        <View style={styles.feedChoices}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !followingOnly }}
            onPress={() => {
              setLoading(true);
              setError('');
              setFollowingOnly(false);
            }}
            style={styles.feedChoice}
          >
            <Text style={styles.action}>Everyone</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: followingOnly }}
            onPress={() => {
              setLoading(true);
              setError('');
              setFollowingOnly(true);
            }}
            style={styles.feedChoice}
          >
            <Text style={styles.action}>Following</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => {
            setLoading(true);
            setError('');
            setRefresh((value) => value + 1);
          }}
          style={styles.refresh}
        >
          <Text style={styles.action}>{error ? 'Retry postcards' : 'Refresh postcards'}</Text>
        </Pressable>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading postcards" color="#283A70" />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {error}
          </Text>
        ) : recommendations.length === 0 ? (
          <Text style={styles.notice}>
            {followingOnly
              ? 'No recommendations from people you follow yet.'
              : 'No postcards for Seattle yet.'}
          </Text>
        ) : (
          recommendations.map((rec) => (
            <React.Fragment key={rec.id}>
              <PostcardRecommendation recommendation={rec} onOpenPlace={onOpenPlace} />
              {rec.author && rec.author.id !== currentUserId ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={followingBusy !== null}
                  onPress={() => void toggleFollow(rec.author?.id ?? '')}
                  style={styles.followAction}
                >
                  <Text style={styles.action}>
                    {followingBusy === rec.author.id
                      ? 'Updating…'
                      : followingIds.includes(rec.author.id)
                        ? 'Following · Unfollow'
                        : `Follow ${rec.author.name}`}
                  </Text>
                </Pressable>
              ) : null}
            </React.Fragment>
          ))
        )}
        {followError ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {followError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

//title for screen
const SCRIPT = Platform.select({ ios: 'Snell Roundhand', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3EEE2',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 40,
    fontFamily: SCRIPT,
    color: '#283A70',
    marginBottom: 16,
  },
  notice: { color: '#505A72', fontSize: 13, lineHeight: 20 },
  refresh: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  action: { color: '#283A70', fontSize: 14, fontWeight: '600' },
  feedChoices: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  feedChoice: { ...buttonOutline, minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  followAction: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#F3EEE2' },
});
