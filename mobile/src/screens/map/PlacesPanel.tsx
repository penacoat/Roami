import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Platform,
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
  onBack?: () => void;
  citySelector?: React.ReactNode;
  children: React.ReactNode;
}

/** Only the handle captures drags, leaving map gestures and list scrolling independent. */
export function PlacesPanel({
  availableHeight,
  expanded,
  onExpandedChange,
  title,
  onBack,
  citySelector,
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
        useNativeDriver: Platform.OS !== 'web',
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
        <View style={styles.handle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse places panel' : 'Expand places panel'}
            accessibilityHint="Swipe the handle or double-tap to switch between the map and the list."
            accessibilityState={{ expanded }}
            onPress={() => {
              Keyboard.dismiss();
              settle(!expanded);
            }}
            style={styles.gripTouch}
          >
            <View style={styles.grip} />
          </Pressable>
          <View style={styles.heading}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close place details"
                onPress={onBack}
                style={styles.touch}
              >
                <Text style={styles.title}>← Back to places</Text>
              </Pressable>
            ) : (
              <View style={styles.placeSummary}>
                {citySelector}
                <Text style={styles.count}>{title}</Text>
              </View>
            )}
          </View>
        </View>
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
  gripTouch: { minHeight: 28, width: '100%', justifyContent: 'center', alignItems: 'center' },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  touch: { minHeight: 44, justifyContent: 'center' },
  heading: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  placeSummary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
  },
  count: { color: colors.muted, fontSize: 12 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  content: { minHeight: 0, overflow: 'hidden' },
});
