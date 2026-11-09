import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Keyboard, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from './theme';
import { buttonOutline } from '../../components/buttonStyles';

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
  const collapsedHeight = Math.min(196, availableHeight * 0.52);
  const expandedHeight = Math.max(collapsedHeight, availableHeight * 0.82);
  const [height] = useState(() => new Animated.Value(collapsedHeight));
  const animate = useCallback(
    (isExpanded: boolean) => {
      Animated.timing(height, {
        toValue: isExpanded ? expandedHeight : collapsedHeight,
        duration: 180,
        useNativeDriver: false,
      }).start();
    },
    [height, collapsedHeight, expandedHeight],
  );

  useEffect(() => {
    animate(expanded);
  }, [expanded, animate]);

  const settle = useCallback(
    (isExpanded: boolean) => {
      onExpandedChange(isExpanded);
      animate(isExpanded);
    },
    [onExpandedChange, animate],
  );

  const pan = useMemo(() => {
    let dragStart = collapsedHeight;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        Keyboard.dismiss();
        height.stopAnimation((value) => {
          dragStart = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        height.setValue(
          Math.max(collapsedHeight, Math.min(expandedHeight, dragStart - gesture.dy)),
        );
      },
      onPanResponderRelease: (_, gesture) => {
        const open =
          Math.abs(gesture.vy) > 0.35
            ? gesture.vy < 0
            : dragStart - gesture.dy > (collapsedHeight + expandedHeight) / 2;
        settle(open);
      },
      onPanResponderTerminate: () => animate(expanded),
    });
  }, [height, collapsedHeight, expandedHeight, settle, animate, expanded]);

  return (
    <Animated.View style={[styles.panel, { height }]}>
      <View {...pan.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse places panel' : 'Expand places panel'}
          accessibilityHint="Drag the handle or double-tap to switch between the map and the list."
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
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  handle: {
    ...buttonOutline,
    borderRadius: 20,
    height: 54,
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
  },
  title: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  action: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  content: { flex: 1, minHeight: 0 },
});
