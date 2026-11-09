import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';

// Jest 30's imported expect reads matchers from this module.
declare module 'expect' {
  // Module augmentation must retain Jest's generic signature and extend its interface.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void>, T = unknown> extends JestNativeMatchers<R> {}
}
