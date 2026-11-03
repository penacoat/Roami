import { Platform } from 'react-native';

export const tripTheme = {
  paper: '#F3EEE2',
  card: '#FCFAF4',
  ink: '#283A70',
  text: '#27334E',
  muted: '#505A72',
  line: '#DFD7C5',
  accent: '#A83E28',
  butter: '#EADFAD',
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
};
