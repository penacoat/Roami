import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fonts, palette } from './tokens';

/** Static page identity; motion is reserved for actual loading. */
export function PageSignature({ title }: { title: string }) {
  return (
    <View style={styles.container} accessible accessibilityRole="header" accessibilityLabel={title}>
      <View
        style={styles.line}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.title}>{title.toLowerCase()}</Text>
        <Svg
          width="100%"
          height={10}
          viewBox="0 0 120 10"
          preserveAspectRatio="none"
          style={styles.tail}
        >
          <Path
            d="M 2 6 C 30 2 66 8 118 4"
            fill="none"
            stroke={palette.primary}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { minHeight: 52, justifyContent: 'center', alignSelf: 'stretch', marginBottom: 8 },
  line: { alignSelf: 'flex-start', alignItems: 'stretch' },
  title: { color: palette.primary, fontFamily: fonts.script, fontSize: 32, lineHeight: 44 },
  tail: { marginTop: -7 },
});
