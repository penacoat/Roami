// Stands in for the native time wheel in tests. The real picker is a native
// component, so tests render a plain View and fire its onChange directly.
import { jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

export function timePickerModule() {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, props),
  };
}

/** Opens the start or end field whose label starts with `label` and picks a time. */
export async function pickTime(label: string, hour: number, minute = 0) {
  const which = label.startsWith('Start') ? 'start' : 'end';
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${label}, `) }));
  const date = new Date(2000, 0, 1, hour, minute);
  await fireEvent(screen.getByTestId(`${which}-time-picker`), 'change', { type: 'set' }, date);
}
