import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { signOut } from '../../auth/AuthService';
import { MapScreen } from '../../screens/MapScreen';

export default function ExploreRoute() {
  const navigation = useNavigation<{ setParams(params: { placeId?: string }): void }>();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const [savedRefreshKey, setSavedRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setSavedRefreshKey((value) => value + 1), []));
  const clearRequest = useCallback(
    () => navigation.setParams({ placeId: undefined }),
    [navigation],
  );
  return (
    <MapScreen
      onSignOut={signOut}
      savedRefreshKey={savedRefreshKey}
      requestedPlaceId={typeof placeId === 'string' ? placeId : undefined}
      onPlaceRequestHandled={clearRequest}
    />
  );
}
