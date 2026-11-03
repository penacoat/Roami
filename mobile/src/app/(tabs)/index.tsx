import { signOut } from '../../auth/AuthService';
import { MapScreen } from '../../screens/MapScreen';

export default function ExploreRoute() {
  return <MapScreen onSignOut={signOut} />;
}
