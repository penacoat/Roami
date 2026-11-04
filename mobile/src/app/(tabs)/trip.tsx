import { signOut } from '../../auth/AuthService';
import { TripCreationScreen } from '../../screens/TripCreationScreen';

export default function NewTripRoute() {
  return <TripCreationScreen onSignOut={signOut} />;
}
