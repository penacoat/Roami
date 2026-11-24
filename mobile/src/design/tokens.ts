import { Platform } from 'react-native';

export const palette = {
  navy: '#101F32',
  paper: '#F3EEE2',
  card: '#FCFAF4',
  ink: '#27334E',
  primary: '#283A70',
  muted: '#505A72',
  line: '#DFD7C5',
  red: '#A83E28',
};

export const fonts = {
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  script: 'Sacramento_400Regular',
};

export const type = {
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  action: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28 },
};
