import React, { useEffect, useState } from 'react';
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
import type { RecommendationView } from '@roami/shared';
import { callApi } from '../../api';
import { useCity, nearCity } from '../../cities/CityProvider';
import { CitySelector } from '../../cities/CitySelector';
import { buttonOutline } from '../buttonStyles';
import { PostcardRecommendation } from './postcardRecommendation';
import { PageSignature } from '../../design/PageSignature';
import { palette, type } from '../../design/tokens';

export function RecommendationsScreen({
  onOpenPlace,
}: {
  onOpenPlace: (placeId: string, recommendationId: string) => void;
}) {
  const { city, setCity } = useCity();
  const [items, setRecommendations] = useState<RecommendationView[]>([]);
  const [itemsCity, setItemsCity] = useState('');
  const cityKey = `${city.id}:${city.cityId ?? ''}`;
  const recommendations = itemsCity === cityKey ? items : [];
  const [loadedKey, setLoadedKey] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const loadKey = `${cityKey}:${refresh}`;
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let active = true;
    callApi('getFeed', { city: city.name, ...(city.cityId && { cityId: city.cityId }) })
      .then(({ items }) => {
        if (active) {
          setRecommendations(
            items.filter(
              (item) =>
                item.status === 'available' &&
                ((city.cityId && item.place.cityId === city.cityId) || nearCity(item.place, city)),
            ),
          );
          setItemsCity(cityKey);
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
        }
      });
    return () => {
      active = false;
    };
  }, [loadKey, city, cityKey]);

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
          !error && <Text style={styles.notice}>No postcards for {city.name} yet.</Text>
        ) : (
          recommendations.map((rec) => (
            <PostcardRecommendation key={rec.id} recommendation={rec} onOpenPlace={onOpenPlace} />
          ))
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
  notice: { ...type.body, color: palette.muted },
  refresh: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  action: { ...type.action, color: palette.primary },
});
