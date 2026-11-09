import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../screens/map/theme';
import { buttonOutline } from '../../components/buttonStyles';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icons: Record<string, readonly [IconName, IconName]> = {
  index: ['compass-outline', 'compass'],
  postcards: ['mail-outline', 'mail'],
  trip: ['map-outline', 'map'],
  saved: ['bookmark-outline', 'bookmark'],
};

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'none',
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingTop: 4,
          paddingBottom: 4 + insets.bottom,
        },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { ...buttonOutline, borderRadius: 12, marginHorizontal: 4 },
        tabBarIcon: ({ focused }) => (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 48,
              height: 28,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? '#EEDFA4' : 'transparent',
            }}
          >
            <Ionicons
              name={(icons[route.name] ?? ['ellipse-outline', 'ellipse'])[focused ? 1 : 0]}
              size={23}
              color={focused ? colors.primary : colors.muted}
              accessible={false}
            />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="postcards" options={{ title: 'Postcards' }} />
      <Tabs.Screen name="trip" options={{ title: 'Itineraries' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
    </Tabs>
  );
}
