import { StyleSheet } from 'react-native';
import { buttonOutline } from '../components/buttonStyles';
import { tripTheme as theme } from './tripTheme';

export const itineraryStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.paper },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: theme.ink, fontFamily: theme.serif, fontSize: 30, fontWeight: '700' },
  heading: { color: theme.ink, fontFamily: theme.serif, fontSize: 22, fontWeight: '700' },
  text: { color: theme.text, fontSize: 15, lineHeight: 22 },
  muted: { color: theme.muted, fontSize: 13, lineHeight: 20 },
  error: { color: theme.accent, fontSize: 14, lineHeight: 21 },
  button: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: theme.ink, borderColor: theme.ink },
  buttonText: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  primaryText: { color: theme.card, fontSize: 14, fontWeight: '600' },
  card: { ...buttonOutline, padding: 16, gap: 6, backgroundColor: theme.card },
  selected: { backgroundColor: theme.butter, borderColor: theme.ink },
  disabled: { opacity: 0.5 },
  timeChip: { alignSelf: 'flex-start', paddingVertical: 4 },
  timeText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  field: { flexGrow: 1, flexBasis: 120, gap: 4 },
  pickerField: { justifyContent: 'center', paddingVertical: 8, gap: 2 },
  pickerValue: { color: theme.ink, fontSize: 17, fontWeight: '600' },
  input: {
    ...buttonOutline,
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: theme.card,
    color: theme.ink,
    fontSize: 16,
  },
});
