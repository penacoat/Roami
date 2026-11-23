import type { PlaceSummary, SavedPlaceView, SearchResult } from '@roami/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callApi } from '../../api';
import {
  notifySavedPlacesChanged,
  useSavedPlacesChangeVersion,
} from '../../hooks/useSavedPlacesChanges';
import { categoryName, hasCoordinates } from './mapUtils';

const NO_RESULTS: SearchResult[] = [];
interface SearchState {
  key: string;
  results: SearchResult[];
  status: 'ready' | 'error';
}

/** All Explore data comes through the shared API, independent of the map renderer. */
export function usePlaces(city: string, savedRefreshKey: number) {
  const [refresh, setRefresh] = useState(0);
  const savedChanges = useSavedPlacesChangeVersion('explore');
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Map<string, SavedPlaceView>>(new Map());
  const saveInFlight = useRef(false);
  const savedRevision = useRef(0);
  const [saveAction, setSaveAction] = useState({
    placeId: '',
    pending: '',
    notice: '',
    failed: false,
  });
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [loadStatus, setLoadStatus] = useState({ key: '', error: '' });
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [savedRefreshError, setSavedRefreshError] = useState('');
  const text = query.trim() ? settledQuery.trim() : '';
  const loadKey = JSON.stringify([city, refresh]);
  const loading = loadStatus.key !== loadKey;
  const error = loading ? '' : loadStatus.error;
  const searchKey = JSON.stringify([city, text, searchRetry]);
  const searching = query.trim() !== text || (text !== '' && search?.key !== searchKey);
  const searchFailed = text !== '' && search?.key === searchKey && search.status === 'error';
  const results =
    text && search?.key === searchKey && search.status === 'ready' ? search.results : NO_RESULTS;

  useEffect(() => {
    // Clearing is immediate; typing waits until the user pauses before changing pins.
    const timer = setTimeout(() => setSettledQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    callApi('listPlaces', { city })
      .then(({ places: catalog }) => {
        if (!active) return;
        setPlaces(catalog);
        setLoadStatus({ key: loadKey, error: '' });
      })
      .catch(() => {
        if (active)
          setLoadStatus({
            key: loadKey,
            error: 'Could not load places. Check your connection and try again.',
          });
      });
    return () => {
      active = false;
    };
  }, [city, loadKey]);

  // Saved can change on another tab while Explore remains mounted.
  useEffect(() => {
    let active = true;
    const revision = ++savedRevision.current;
    callApi('listSavedPlaces', {})
      .then(({ saved }) => {
        if (active && revision === savedRevision.current) {
          setSavedRefreshError('');
          setSavedPlaces(new Map(saved.map((item) => [item.place.id, item])));
          setSaveAction((current) =>
            current.pending ? current : { placeId: '', pending: '', notice: '', failed: false },
          );
        }
      })
      .catch(() => {
        if (active) setSavedRefreshError('Could not refresh Saved. Tap Refresh to try again.');
      });
    return () => {
      active = false;
    };
  }, [savedRefreshKey, refresh, savedChanges]);

  useEffect(() => {
    if (!text) return;
    let active = true;
    callApi('searchRecommendations', { text, interests: [], city, limit: 50 })
      .then(({ results: matches }) => {
        if (active) setSearch({ key: searchKey, results: matches, status: 'ready' });
      })
      .catch(() => {
        if (active) setSearch({ key: searchKey, results: [], status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [city, text, searchKey]);

  const categories = useMemo(
    () => [...new Set(places.map((place) => categoryName(place.category)))].sort(),
    [places],
  );
  const matches = useMemo(() => {
    const byPlace = new Map<string, SearchResult>();
    for (const result of results) {
      if (!byPlace.has(result.recommendation.place.id))
        byPlace.set(result.recommendation.place.id, result);
    }
    return byPlace;
  }, [results]);
  const visible = useMemo(
    () =>
      places.filter(
        (place) =>
          (!savedOnly || savedPlaces.has(place.id)) &&
          (category === null || categoryName(place.category) === category) &&
          (!text ||
            `${place.name} ${place.category}`.toLowerCase().includes(text.toLowerCase()) ||
            matches.has(place.id)),
      ),
    [places, savedOnly, savedPlaces, category, text, matches],
  );
  const pins = useMemo(() => visible.filter(hasCoordinates), [visible]);
  async function changeSaved(placeId: string, remove: boolean, recommendationId?: string) {
    // Keep the lock above the detail card so closing it cannot start competing writes.
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    savedRevision.current += 1;
    setSaveAction({
      placeId,
      pending: remove ? 'Removing…' : 'Saving…',
      notice: '',
      failed: false,
    });
    try {
      const entry = remove
        ? (await callApi('removeSavedPlace', { placeId }), undefined)
        : (await callApi('savePlace', { placeId, recommendationId })).saved;
      savedRevision.current += 1;
      setSavedPlaces((current) => {
        const next = new Map(current);
        if (entry) next.set(placeId, entry);
        else next.delete(placeId);
        return next;
      });
      notifySavedPlacesChanged('explore');
      setSaveAction({
        placeId,
        pending: '',
        notice: remove
          ? 'Removed from Saved. You can save this place again.'
          : recommendationId
            ? 'Saved with this recommendation.'
            : 'Place saved.',
        failed: false,
      });
    } catch {
      setSaveAction({
        placeId,
        pending: '',
        notice: remove
          ? 'Could not unsave. Please try again.'
          : 'Could not save. Please try again.',
        failed: true,
      });
    } finally {
      saveInFlight.current = false;
    }
  }

  const refreshPlaces = useCallback(() => {
    setRefresh((value) => value + 1);
    setSearchRetry((value) => value + 1);
  }, []);
  const resetFilters = useCallback(() => {
    setQuery('');
    setCategory(null);
    setSavedOnly(false);
  }, []);
  return {
    places,
    savedPlaces,
    saveAction,
    query,
    setQuery,
    category,
    setCategory,
    savedOnly,
    setSavedOnly,
    loading,
    error,
    searching,
    searchFailed,
    savedRefreshError,
    categories,
    matches,
    visible,
    pins,
    changeSaved,
    refreshPlaces,
    resetFilters,
    retrySearch: () => setSearchRetry((value) => value + 1),
  };
}
export type PlacesState = ReturnType<typeof usePlaces>;
