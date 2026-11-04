import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { SavedPlacesScreen } from '../../screens/SavedPlacesScreen';

export default function SavedRoute() {
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setRefreshKey((value) => value + 1), []));
  return (
    <SavedPlacesScreen
      refreshKey={refreshKey}
      onExplore={() => router.navigate('/')}
      onOpenPlace={(placeId) => router.navigate({ pathname: '/', params: { placeId } })}
    />
  );
}
