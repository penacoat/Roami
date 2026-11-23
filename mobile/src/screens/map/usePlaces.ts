import type { CityLocation, PlaceSummary, SavedPlaceView, SearchResult } from '@roami/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callApi } from '../../api';
import { nearCity } from '../../cities/CityProvider';
import {
  notifySavedPlacesChanged,
  useSavedPlacesChangeVersion,
} from '../../hooks/useSavedPlacesChanges';
import { categoryName, hasCoordinates } from './mapUtils';

const NO_PLACES: PlaceSummary[] = [];
const NO_RESULTS: SearchResult[] = [];
interface SearchState {
  key: string;
  results: SearchResult[];
  status: 'ready' | 'error';
}

/** All Explore data comes through the shared API, independent of the map renderer. */
export function usePlaces(city: string, savedRefreshKey: number, location?: CityLocation) {
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const savedChanges = useSavedPlacesChangeVersion('explore');
  const [catalog, setPlaces] = useState<PlaceSummary[]>([]);
  const [catalogCity, setCatalogCity] = useState('');
  const cityKey = JSON.stringify([city, location?.id]);
  const places = catalogCity === cityKey ? catalog : NO_PLACES;
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
  const loadKey = JSON.stringify([city, location?.id, refresh]);
  const loading = loadStatus.key !== loadKey;
  const error = loading ? '' : loadStatus.error;
  const searchKey = JSON.stringify([city, location?.id, text, searchRetry]);
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
        const next = location
          ? catalog.filter(
              (place) =>
                !Number.isFinite(place.latitude) ||
                !Number.isFinite(place.longitude) ||
                nearCity(place, location),
            )
          : catalog;
        setPlaces((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        setCatalogCity(cityKey);
        setLoadStatus({ key: loadKey, error: '' });
      })
      .catch(() => {
        if (active)
          setLoadStatus({
            key: loadKey,
            error: 'Could not load places. Check your connection and try again.',
          });
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [city, cityKey, loadKey, location]);

  // Saved can change on another tab while Explore remains mounted.
  useEffect(() => {
    let active = true;
    const revision = ++savedRevision.current;
    callApi('listSavedPlaces', {})
      .then(({ saved }) => {
        if (active && revision === savedRevision.current) {
          setSavedRefreshError('');
          setSavedPlaces((current) => {
            const next = new Map(saved.map((item) => [item.place.id, item]));
            return JSON.stringify([...current]) === JSON.stringify([...next]) ? current : next;
          });
          setSaveAction((current) =>
            current.pending ? current : { placeId: '', pending: '', notice: '', failed: false },
          );
        }
      })
      .catch(() => {
        if (active) setSavedRefreshError('Could not refresh Saved. Pull down or retry.');
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
      const entry =
        remove && recommendationId
          ? (await callApi('removeSavedRecommendation', { placeId, recommendationId })).saved
          : remove
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
        notice:
          remove && recommendationId
            ? 'Recommendation removed. The place is still saved.'
            : remove
              ? 'Removed from Saved. You can save this place again.'
              : recommendationId
                ? 'Recommendation saved with this place.'
                : 'Place saved.',
        failed: false,
      });
    } catch {
      setSaveAction({
        placeId,
        pending: '',
        notice:
          remove && recommendationId
            ? 'Could not remove this recommendation. Please try again.'
            : remove
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
  const pullToRefresh = useCallback(() => {
    if (loading) return;
    setRefreshing(true);
    refreshPlaces();
  }, [loading, refreshPlaces]);
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
    refreshing,
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
    pullToRefresh,
    resetFilters,
    retrySearch: () => setSearchRetry((value) => value + 1),
  };
}
export type PlacesState = ReturnType<typeof usePlaces>;
