import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RecommendationView } from '@roami/shared';
import { callApi } from '../../api';
import { buttonOutline } from '../buttonStyles';
import { PostcardRecommendation } from './postcardRecommendation';

export function RecommendationsScreen({ onOpenPlace }: { onOpenPlace: (placeId: string) => void }) {
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    callApi('getFeed', { city: 'Seattle' })
      .then(({ items }) => {
        if (active) setRecommendations(items.filter((item) => item.status === 'available'));
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
  }, [refresh]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Postcards from Seattle
        </Text>
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
          <Text style={styles.notice}>No postcards for Seattle yet.</Text>
        ) : (
          recommendations.map((rec) => (
            <PostcardRecommendation key={rec.id} recommendation={rec} onOpenPlace={onOpenPlace} />
          ))
        )}
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
});
