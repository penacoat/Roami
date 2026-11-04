import { useEffect, useState } from 'react';

type Source = 'explore' | 'saved';
const listeners = new Set<(source: Source) => void>();

export function notifySavedPlacesChanged(source: Source) {
  listeners.forEach((listener) => listener(source));
}

/** A write can finish after its screen loses focus. Refresh other mounted screens then too. */
export function useSavedPlacesChangeVersion(source: Source) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = (writer: Source) => {
      if (writer !== source) setVersion((value) => value + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [source]);
  return version;
}
