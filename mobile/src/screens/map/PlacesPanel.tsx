import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { colors } from './theme';

interface Props {
  availableHeight: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title: string;
  children: React.ReactNode;
}

/** Only the handle captures drags, leaving map gestures and list scrolling independent. */
export function PlacesPanel({
  availableHeight,
  expanded,
  onExpandedChange,
  title,
  children,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const collapsedHeight = Math.min(280, availableHeight * 0.58);
  const expandedHeight = Math.max(
    collapsedHeight,
    availableHeight * (fontScale > 1.3 || availableHeight < 420 ? 1 : 0.88),
  );
  const [handleHeight, setHandleHeight] = useState(54);
  const travel = expandedHeight - collapsedHeight;
  const [offset] = useState(() => new Animated.Value(expanded ? 0 : travel));
  const animate = useCallback(
    (isExpanded: boolean) => {
      Animated.timing(offset, {
        toValue: isExpanded ? 0 : travel,
        duration: 180,
        useNativeDriver: true,
        isInteraction: false,
      }).start();
    },
    [offset, travel],
  );

  useEffect(() => {
    animate(expanded);
  }, [expanded, animate]);

  const settle = useCallback(
    (isExpanded: boolean) => {
      onExpandedChange(isExpanded);
    },
    [onExpandedChange],
  );

  const pan = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) > 20 || Math.abs(gesture.vy) > 0.35) {
          settle(gesture.dy < 0);
        }
      },
      onPanResponderTerminate: () => animate(expanded),
    });
  }, [settle, animate, expanded]);

  return (
    <Animated.View
      style={[styles.panel, { height: expandedHeight, transform: [{ translateY: offset }] }]}
    >
      <View
        {...pan.panHandlers}
        onLayout={({ nativeEvent }) => setHandleHeight(nativeEvent.layout.height)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse places panel' : 'Expand places panel'}
          accessibilityHint="Swipe the handle or double-tap to switch between the map and the list."
          accessibilityState={{ expanded }}
          onPress={() => {
            Keyboard.dismiss();
            settle(!expanded);
          }}
          style={styles.handle}
        >
          <View style={styles.grip} />
          <View style={styles.heading}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.action}>{expanded ? 'Show map ↓' : 'Show list ↑'}</Text>
          </View>
        </Pressable>
      </View>
      <View
        style={[
          styles.content,
          { height: Math.max(0, (expanded ? expandedHeight : collapsedHeight) - handleHeight - 2) },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  handle: {
    borderRadius: 20,
    minHeight: 54,
    paddingBottom: 10,
    alignItems: 'center',
    paddingTop: 7,
    paddingHorizontal: 18,
    gap: 8,
  },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  heading: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  action: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  content: { minHeight: 0, overflow: 'hidden' },
});
