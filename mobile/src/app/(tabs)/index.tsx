import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { signOut } from '../../auth/AuthService';
import { MapScreen } from '../../screens/MapScreen';

export default function ExploreRoute() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const clearRequest = useCallback(() => router.setParams({ placeId: undefined }), []);
  return (
    <MapScreen
      onSignOut={signOut}
      requestedPlaceId={typeof placeId === 'string' ? placeId : undefined}
      onPlaceRequestHandled={clearRequest}
    />
  );
}
