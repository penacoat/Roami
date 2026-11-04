import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import type { RecommendationView } from '@roami/shared';
import { callApi } from '../../api';
import { PostcardRecommendation } from './postcardRecommendation';

export function RecommendationsScreen() {
  const [recommendations, setRecommendations] = useState<RecommendationView[]>([]);

  useEffect(() => {
    async function load() {
      const response = await callApi('getFeed', { city: 'Seattle' });
      setRecommendations(response.items);
    }
    load();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Postcards from Seattle</Text>
      {recommendations.map((rec) => (
        <PostcardRecommendation key={rec.id} recommendation={rec} />
      ))}
    </ScrollView>
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
    paddingTop: 64,
  },
  title: {
    fontSize: 40,
    fontFamily: SCRIPT,
    color: '#283A70',
    marginBottom: 16,
  },
});
