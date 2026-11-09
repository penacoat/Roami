import { router } from 'expo-router';
import { signOut } from '../auth/AuthService';
import { TripCreationScreen } from '../screens/TripCreationScreen';

export default function NewTripRoute() {
  return (
    <TripCreationScreen
      onSignOut={signOut}
      onBack={() => router.back()}
      onCreated={(tripId) =>
        router.replace({ pathname: '/itinerary/[tripId]', params: { tripId } })
      }
    />
  );
}
