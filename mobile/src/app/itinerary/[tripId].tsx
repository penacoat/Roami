import { router, useLocalSearchParams } from 'expo-router';
import { ItineraryScreen } from '../../screens/ItineraryScreen';

export default function ItineraryRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return (
    <ItineraryScreen
      key={tripId}
      tripId={tripId}
      onBack={() => router.navigate('/trip')}
      onExplore={() => router.navigate('/')}
      onOpenPlace={(placeId) => router.navigate({ pathname: '/', params: { placeId } })}
    />
  );
}
