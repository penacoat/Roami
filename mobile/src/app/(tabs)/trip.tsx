import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ItinerariesScreen } from '../../screens/ItinerariesScreen';

export default function ItinerariesRoute() {
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setRefreshKey((value) => value + 1), []));
  return (
    <ItinerariesScreen
      refreshKey={refreshKey}
      onCreate={() => router.push('/new-trip')}
      onOpen={(tripId) => router.push({ pathname: '/itinerary/[tripId]', params: { tripId } })}
    />
  );
}
