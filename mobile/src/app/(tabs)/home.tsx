import { router } from 'expo-router';
import { HomeScreen } from '../../screens/HomeScreen';

export default function HomeRoute() {
  return (
    <HomeScreen
      onCreateTrip={() => router.push('/new-trip')}
      onOpenTrip={(tripId) => router.push({ pathname: '/itinerary/[tripId]', params: { tripId } })}
    />
  );
}
