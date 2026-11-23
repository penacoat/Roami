import { StyleSheet } from 'react-native';
import { palette, type } from '../design/tokens';

export const placeActionStyles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...type.action, fontSize: 13, textAlign: 'center', color: palette.primary },
  active: { backgroundColor: '#E5E9F0' },
  section: { borderLeftWidth: 1, borderLeftColor: palette.line },
});
