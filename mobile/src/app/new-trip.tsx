import { router } from 'expo-router';
import { TripCreationScreen } from '../screens/TripCreationScreen';

export default function NewTripRoute() {
  return (
    <TripCreationScreen
      onBack={() => router.back()}
      onCreated={(tripId) =>
        router.replace({ pathname: '/itinerary/[tripId]', params: { tripId } })
      }
    />
  );
}
