import type { PlaceSummary, SavedPlaceView, SearchResult } from '@roami/shared';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callApi } from '../api';
import { buttonOutline } from '../components/buttonStyles';
import {
  notifySavedPlacesChanged,
  useSavedPlacesChangeVersion,
} from '../hooks/useSavedPlacesChanges';
import { PlaceDetails } from './map/PlaceDetails';
import { PlaceMap } from './map/PlaceMap';
import { PlacesPanel } from './map/PlacesPanel';
import { colors } from './map/theme';

const SEATTLE: Region = {
  latitude: 47.6087,
  longitude: -122.341,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};
const NO_RESULTS: SearchResult[] = [];
const NO_PLACES: PlaceSummary[] = [];
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const categoryName = (category: string) => category.trim() || 'Uncategorized';
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const hasCoordinates = (place: PlaceSummary) =>
  Number.isFinite(place.latitude) &&
  Number.isFinite(place.longitude) &&
  Math.abs(place.latitude) <= 90 &&
  Math.abs(place.longitude) <= 180;

interface Props {
  onSignOut: () => Promise<void>;
  requestedPlaceId?: string;
  requestedRecommendationId?: string;
  onPlaceRequestHandled?: () => void;
  savedRefreshKey?: number;
}
interface SearchState {
  key: string;
  results: SearchResult[];
  status: 'ready' | 'error';
}

export function MapScreen({
  onSignOut,
  requestedPlaceId,
  requestedRecommendationId,
  onPlaceRequestHandled,
  savedRefreshKey = 0,
}: Props) {
  const map = useRef<MapView>(null);
  const placeRequestVersion = useRef(0);
  const savedChanges = useSavedPlacesChangeVersion('explore');
  const region = useRef(SEATTLE);
  const mapReady = useRef(false);
  const [city, setCity] = useState('Seattle');
  const [cityDraft, setCityDraft] = useState(city);
  const [editingCity, setEditingCity] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Map<string, SavedPlaceView>>(new Map());
  const saveInFlight = useRef(false);
  const savedRevision = useRef(0);
  const lastFit = useRef('');
  const [saveAction, setSaveAction] = useState({
    placeId: '',
    pending: '',
    notice: '',
    failed: false,
  });
  const [selected, setSelected] = useState<PlaceSummary | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>();
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [loadStatus, setLoadStatus] = useState({ key: '', error: '' });
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [signOutError, setSignOutError] = useState('');
  const [savedRefreshError, setSavedRefreshError] = useState('');
  const [placeRequestError, setPlaceRequestError] = useState('');
  const openingPlace = Boolean(requestedPlaceId);
  const [signingOut, setSigningOut] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(600);
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
    const revision = savedRevision.current;
    Promise.all([callApi('listPlaces', { city }), callApi('listSavedPlaces', {})])
      .then(([placeResult, savedResult]) => {
        if (!active) return;
        setPlaces(placeResult.places);
        if (revision === savedRevision.current)
          setSavedPlaces(new Map(savedResult.saved.map((item) => [item.place.id, item])));
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
    if (savedRefreshKey === 0 && savedChanges === 0) return;
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
  const fitKey = JSON.stringify(
    pins.map(({ id, latitude, longitude }) => [id, latitude, longitude]),
  );

  const fitPlaces = useCallback((items: PlaceSummary[]) => {
    const valid = items.filter(hasCoordinates);
    if (!mapReady.current || valid.length === 0) return;
    if (valid.length === 1) {
      region.current = {
        latitude: valid[0].latitude,
        longitude: valid[0].longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      map.current?.animateToRegion(region.current, 250);
    } else {
      map.current?.fitToCoordinates(valid, {
        edgePadding: { top: 55, right: 50, bottom: 55, left: 50 },
        animated: true,
      });
    }
  }, []);
  useEffect(() => {
    if (!loading && !searching && !selected && fitKey !== lastFit.current) {
      fitPlaces(visible);
      lastFit.current = fitKey;
    }
  }, [visible, loading, searching, selected, fitKey, fitPlaces]);

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

  const showPlace = useCallback((place: PlaceSummary, recommendationId?: string) => {
    Keyboard.dismiss();
    setSelected(place);
    setSelectedRecommendationId(recommendationId);
    setPanelExpanded(true);
    if (hasCoordinates(place)) {
      region.current = {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      map.current?.animateToRegion(region.current, 250);
    }
  }, []);

  // A newer manual choice wins even if an older navigation request resolves before React rerenders.
  const cancelPlaceRequest = useCallback(() => {
    placeRequestVersion.current += 1;
    setPlaceRequestError('');
    if (requestedPlaceId) onPlaceRequestHandled?.();
  }, [requestedPlaceId, onPlaceRequestHandled]);

  const select = useCallback(
    (place: PlaceSummary, recommendationId?: string) => {
      cancelPlaceRequest();
      showPlace(place, recommendationId);
    },
    [cancelPlaceRequest, showPlace],
  );

  const mapState = useRef({ selected, selectedRecommendationId, visible, showPlace, fitPlaces });
  useLayoutEffect(() => {
    mapState.current = { selected, selectedRecommendationId, visible, showPlace, fitPlaces };
  }, [selected, selectedRecommendationId, visible, showPlace, fitPlaces]);
  const handleMapReady = useCallback(() => {
    mapReady.current = true;
    const current = mapState.current;
    if (current.selected) current.showPlace(current.selected, current.selectedRecommendationId);
    else current.fitPlaces(current.visible);
  }, []);
  const handleRegionChange = useCallback((next: Region) => {
    region.current = next;
  }, []);

  // Postcards currently shows Seattle's catalog. Clear incompatible map filters
  // before opening its place, and consume the request so it can be opened again.
  useEffect(() => {
    if (!requestedPlaceId) return;
    let active = true;
    const version = ++placeRequestVersion.current;
    callApi('listPlaces', { city: 'Seattle' })
      .then(({ places: catalog }) => {
        if (!active || version !== placeRequestVersion.current) return;
        const place = catalog.find((item) => item.id === requestedPlaceId);
        setPlaceRequestError('');
        setSelected(null);
        if (place) {
          setCity('Seattle');
          setCityDraft('Seattle');
          setQuery('');
          setCategory(null);
          setSavedOnly(false);
          setEditingCity(false);
          setRefresh((value) => value + 1);
          showPlace(place, requestedRecommendationId);
        } else {
          setPlaceRequestError('This place is no longer available in the Seattle catalog.');
        }
        onPlaceRequestHandled?.();
      })
      .catch(() => {
        if (!active || version !== placeRequestVersion.current) return;
        setSelected(null);
        setPlaceRequestError(
          'Could not open this place. Return to Postcards or Saved and try again.',
        );
        onPlaceRequestHandled?.();
      });
    return () => {
      active = false;
    };
  }, [requestedPlaceId, requestedRecommendationId, onPlaceRequestHandled, showPlace]);
  function zoom(factor: number) {
    cancelPlaceRequest();
    region.current = {
      ...region.current,
      latitudeDelta: Math.max(0.0005, Math.min(140, region.current.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.0005, Math.min(180, region.current.longitudeDelta * factor)),
    };
    map.current?.animateToRegion(region.current, 200);
  }
  function applyCity() {
    const next = cityDraft.trim().replace(/\s+/g, ' ');
    if (!next) return;
    cancelPlaceRequest();
    Keyboard.dismiss();
    setCity(next);
    setEditingCity(false);
    setCategory(null);
    setSelected(null);
    setQuery('');
  }
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
    } catch {
      setSignOutError('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text accessibilityRole="header" style={styles.title}>
              Roami
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change city: ${city}`}
            accessibilityState={{ expanded: editingCity }}
            onPress={() => {
              cancelPlaceRequest();
              setCityDraft(city);
              setEditingCity(!editingCity);
            }}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{city} ▾</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            style={styles.textButton}
          >
            <Text style={styles.link}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>
        {savedRefreshError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {savedRefreshError}
          </Text>
        )}
        {signOutError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {signOutError}
          </Text>
        )}
        {placeRequestError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {placeRequestError}
          </Text>
        )}
        {editingCity && (
          <View style={styles.cityForm}>
            <TextInput
              accessibilityLabel="City name"
              placeholder="City name, e.g. Seattle"
              value={cityDraft}
              onChangeText={setCityDraft}
              onSubmitEditing={applyCity}
              returnKeyType="go"
              autoCapitalize="words"
              style={[styles.input, styles.grow]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply city"
              disabled={!cityDraft.trim()}
              onPress={applyCity}
              style={styles.chip}
            >
              <Text style={styles.link}>Apply</Text>
            </Pressable>
          </View>
        )}
        <View
          style={[styles.grow, styles.mapCanvas]}
          onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.height > 0) setAvailableHeight(nativeEvent.layout.height);
          }}
        >
          <View style={styles.mapArea}>
            <PlaceMap
              mapRef={map}
              places={!loading && !error ? pins : NO_PLACES}
              selectedId={selected?.id}
              initialRegion={SEATTLE}
              bottomInset={Math.min(280, availableHeight * 0.58)}
              onReady={handleMapReady}
              onRegionChange={handleRegionChange}
              onSelect={select}
            />
            <View style={styles.mapTools}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={() => zoom(0.5)}
                style={styles.mapButton}
              >
                <Text style={styles.zoom}>+</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={() => zoom(2)}
                style={styles.mapButton}
              >
                <Text style={styles.zoom}>−</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show all visible places on map"
                disabled={pins.length === 0 || loading}
                onPress={() => {
                  cancelPlaceRequest();
                  fitPlaces(visible);
                }}
                style={styles.mapButton}
              >
                <Text accessible={false} style={styles.zoom}>
                  ⌖
                </Text>
              </Pressable>
            </View>
            {!loading && pins.length < visible.length && (
              <View style={styles.mapNotice}>
                <Text style={styles.caption}>
                  {visible.length - pins.length} places have no map location.
                </Text>
              </View>
            )}
          </View>
          <PlacesPanel
            availableHeight={availableHeight}
            expanded={panelExpanded}
            onExpandedChange={setPanelExpanded}
            title={
              selected
                ? 'Place details'
                : loading
                  ? 'Loading places…'
                  : searching
                    ? 'Searching…'
                    : `${visible.length} ${visible.length === 1 ? 'place' : 'places'}`
            }
          >
            {openingPlace ? (
              <ActivityIndicator accessibilityLabel="Opening place" color={colors.primary} />
            ) : selected ? (
              <PlaceDetails
                key={`${selected.id}:${selectedRecommendationId ?? ''}`}
                place={selected}
                highlightedRecommendationId={selectedRecommendationId}
                saved={savedPlaces.get(selected.id)}
                pending={saveAction.pending}
                notice={saveAction.placeId === selected.id ? saveAction.notice : ''}
                saveFailed={saveAction.failed}
                onClose={() => setSelected(null)}
                onSave={(recommendationId) =>
                  void changeSaved(selected.id, false, recommendationId)
                }
                onUnsave={() => void changeSaved(selected.id, true)}
              />
            ) : (
              <FlatList
                data={loading || error ? NO_PLACES : visible}
                keyExtractor={(place) => place.id}
                style={styles.grow}
                contentContainerStyle={styles.cards}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListHeaderComponent={
                  <View style={styles.listHeader}>
                    <View style={styles.searchRow}>
                      <TextInput
                        accessibilityLabel="Search places"
                        placeholder="Search places or recommendations"
                        placeholderTextColor={colors.muted}
                        value={query}
                        maxLength={200}
                        onFocus={() => setPanelExpanded(true)}
                        onChangeText={(value) => {
                          cancelPlaceRequest();
                          setQuery(value);
                        }}
                        autoCorrect={false}
                        returnKeyType="search"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        style={[styles.input, styles.grow]}
                      />
                      {query !== '' && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Clear search"
                          onPress={() => {
                            cancelPlaceRequest();
                            setQuery('');
                          }}
                          style={styles.textButton}
                        >
                          <Text accessible={false} style={styles.zoom}>
                            ×
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Refresh places and saves"
                        onPress={() => {
                          cancelPlaceRequest();
                          setRefresh((value) => value + 1);
                          setSearchRetry((value) => value + 1);
                        }}
                        style={styles.textButton}
                      >
                        <Text accessible={false} style={styles.zoom}>
                          ↻
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.filterRow}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.chips}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Saved · ${savedPlaces.size}`}
                          accessibilityState={{ selected: savedOnly }}
                          onPress={() => {
                            cancelPlaceRequest();
                            setSavedOnly(!savedOnly);
                            setRefresh((value) => value + 1);
                            setPanelExpanded(true);
                          }}
                          style={[styles.chip, savedOnly && styles.activeChip]}
                        >
                          <Text style={[styles.chipText, savedOnly && styles.activeText]}>
                            Saved · {savedPlaces.size}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: category === null }}
                          onPress={() => {
                            cancelPlaceRequest();
                            setCategory(null);
                          }}
                          style={[styles.chip, category === null && styles.activeChip]}
                        >
                          <Text style={[styles.chipText, category === null && styles.activeText]}>
                            All categories
                          </Text>
                        </Pressable>
                        {categories.map((item) => (
                          <Pressable
                            key={item}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter category: ${label(item)}`}
                            accessibilityState={{ selected: category === item }}
                            onPress={() => {
                              cancelPlaceRequest();
                              setCategory(category === item ? null : item);
                              setPanelExpanded(true);
                            }}
                            style={[styles.chip, category === item && styles.activeChip]}
                          >
                            <Text style={[styles.chipText, category === item && styles.activeText]}>
                              {label(item)}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    {searchFailed && (
                      <View style={styles.notice}>
                        <Text accessibilityRole="alert" style={styles.caption}>
                          Recommendation search is unavailable. Showing name/category matches only.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setSearchRetry((value) => value + 1)}
                          style={styles.textButton}
                        >
                          <Text style={styles.link}>Retry search</Text>
                        </Pressable>
                      </View>
                    )}
                    {loading ? (
                      <ActivityIndicator
                        accessibilityLabel="Loading places"
                        color={colors.primary}
                        style={styles.notice}
                      />
                    ) : error ? (
                      <View style={styles.notice}>
                        <Text accessibilityRole="alert" style={styles.error}>
                          {error}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setRefresh((value) => value + 1)}
                          style={styles.textButton}
                        >
                          <Text style={styles.link}>Retry places</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                }
                ListEmptyComponent={
                  loading || error ? undefined : (
                    <Text style={styles.empty}>
                      {searching
                        ? 'Searching recommendations…'
                        : places.length === 0
                          ? `No places in the catalog for ${city}. Change city or refresh.`
                          : savedOnly
                            ? 'No saved places match these filters.'
                            : 'No places match. Clear the search or change a category.'}
                    </Text>
                  )
                }
                renderItem={({ item: place }) => {
                  const match = matches.get(place.id),
                    reason = match?.reasons[0];
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${place.name}`}
                      onPress={() => select(place, match?.recommendation.id)}
                      style={styles.card}
                    >
                      <View style={styles.grow}>
                        <Text style={styles.cardCategory}>
                          {label(categoryName(place.category))}
                        </Text>
                        <Text style={styles.cardTitle}>{place.name}</Text>
                        {reason && (
                          <Text style={styles.caption}>
                            {match?.matchLevel === 'broader' ? 'Related' : 'Matches'}:{' '}
                            {reason.matched}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.link}>{savedPlaces.has(place.id) ? 'Saved ✓' : '›'}</Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </PlacesPanel>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  grow: { flex: 1, minHeight: 0 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerTitle: { flexGrow: 1 },
  title: { fontFamily: serif, color: colors.ink, fontSize: 27, fontWeight: '700' },
  cityForm: { paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', gap: 8 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 16,
  },
  listHeader: { marginHorizontal: -14 },
  filterRow: { flexShrink: 0 },
  chips: { paddingHorizontal: 14, gap: 7, paddingBottom: 6 },
  chip: {
    ...buttonOutline,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 22,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  activeText: { color: colors.white },
  textButton: {
    ...buttonOutline,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  notice: { paddingHorizontal: 18, paddingVertical: 8 },
  error: { color: colors.red, fontSize: 13, lineHeight: 20 },
  mapCanvas: { overflow: 'hidden' },
  mapArea: { ...StyleSheet.absoluteFill },
  mapTools: { position: 'absolute', right: 12, top: 12, gap: 6 },
  mapButton: {
    ...buttonOutline,
    backgroundColor: colors.white,
    borderRadius: 9,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoom: { color: colors.primary, fontSize: 26 },
  mapNotice: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    backgroundColor: colors.white,
    padding: 6,
    borderRadius: 6,
  },
  cards: { paddingHorizontal: 14, paddingBottom: 16, gap: 8 },
  card: {
    ...buttonOutline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  cardCategory: { color: colors.red, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardTitle: { color: colors.ink, fontFamily: serif, fontSize: 19, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 10 },
});
