import { Tabs } from 'expo-router';
import { colors } from '../../screens/map/theme';

export default function DemoTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.border },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarItemStyle: { justifyContent: 'center' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="postcards" options={{ title: 'Postcards' }} />
      <Tabs.Screen name="trip" options={{ title: 'New trip' }} />
    </Tabs>
  );
}
