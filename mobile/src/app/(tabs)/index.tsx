import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { MapScreen } from '../../screens/MapScreen';

export default function ExploreRoute() {
  const navigation = useNavigation<{
    setParams(params: { placeId?: string; recommendationId?: string }): void;
  }>();
  const { placeId, recommendationId } = useLocalSearchParams<{
    placeId?: string;
    recommendationId?: string;
  }>();
  const [savedRefreshKey, setSavedRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setSavedRefreshKey((value) => value + 1), []));
  const clearRequest = useCallback(
    () => navigation.setParams({ placeId: undefined, recommendationId: undefined }),
    [navigation],
  );
  return (
    <MapScreen
      savedRefreshKey={savedRefreshKey}
      requestedPlaceId={typeof placeId === 'string' ? placeId : undefined}
      requestedRecommendationId={
        typeof recommendationId === 'string' ? recommendationId : undefined
      }
      onPlaceRequestHandled={clearRequest}
    />
  );
}
