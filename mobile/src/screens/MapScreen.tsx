import type { PlaceSummary, SavedPlaceView, SearchResult } from '@roami/shared';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callApi, getApiMode } from '../api';
import { PlaceDetails } from './map/PlaceDetails';
import { PlacesPanel } from './map/PlacesPanel';
import { colors } from './map/theme';

const SEATTLE: Region = {
  latitude: 47.6087,
  longitude: -122.341,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};
const NO_RESULTS: SearchResult[] = [];
const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const pinColors = [colors.primary, '#39736B', '#875D85', '#98672C', '#556C42'];
const categoryName = (category: string) => category.trim() || 'Uncategorized';
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
function pinColor(category: string) {
  const hash = [...category.toLowerCase()].reduce((value, char) => value + char.charCodeAt(0), 0);
  return pinColors[hash % pinColors.length];
}
const hasCoordinates = (place: PlaceSummary) =>
  Number.isFinite(place.latitude) &&
  Number.isFinite(place.longitude) &&
  Math.abs(place.latitude) <= 90 &&
  Math.abs(place.longitude) <= 180;

interface Props {
  onSignOut: () => Promise<void>;
}
interface SearchState {
  key: string;
  results: SearchResult[];
  status: 'ready' | 'error';
}

export function MapScreen({ onSignOut }: Props) {
  const map = useRef<MapView>(null);
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [loadStatus, setLoadStatus] = useState({ key: '', error: '' });
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(600);
  const text = query.trim();
  const loadKey = JSON.stringify([city, refresh]);
  const loading = loadStatus.key !== loadKey;
  const error = loading ? '' : loadStatus.error;
  const searchKey = JSON.stringify([city, text, searchRetry]);
  const searching = text !== '' && search?.key !== searchKey;
  const searchFailed = text !== '' && search?.key === searchKey && search.status === 'error';
  const results =
    text && search?.key === searchKey && search.status === 'ready' ? search.results : NO_RESULTS;

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

  useEffect(() => {
    if (!text) return;
    let active = true;
    const timer = setTimeout(() => {
      callApi('searchRecommendations', { text, interests: [], city, limit: 50 })
        .then(({ results: matches }) => {
          if (active) setSearch({ key: searchKey, results: matches, status: 'ready' });
        })
        .catch(() => {
          if (active) setSearch({ key: searchKey, results: [], status: 'error' });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
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

  function select(place: PlaceSummary) {
    Keyboard.dismiss();
    setSelected(place);
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
  }
  function zoom(factor: number) {
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
          <View>
            <Text style={styles.wordmark}>ROAMI</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Explore
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change city: ${city}`}
            accessibilityState={{ expanded: editingCity }}
            onPress={() => {
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
        {(getApiMode() === 'fixtures' || process.env.EXPO_PUBLIC_EMULATOR_HOST) && (
          <Text style={styles.modeLabel}>
            {getApiMode() === 'fixtures'
              ? 'Demo data · temporary saves'
              : 'Demo data · places and details unverified'}
          </Text>
        )}
        {signOutError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {signOutError}
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
          style={styles.grow}
          onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.height > 0) setAvailableHeight(nativeEvent.layout.height);
          }}
        >
          <View style={styles.mapArea}>
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              initialRegion={SEATTLE}
              zoomEnabled
              scrollEnabled
              rotateEnabled={false}
              showsUserLocation={false}
              showsMyLocationButton={false}
              onMapReady={() => {
                mapReady.current = true;
                fitPlaces(visible);
              }}
              onRegionChangeComplete={(next) => {
                region.current = next;
              }}
            >
              {!loading &&
                !error &&
                pins.map((place) => (
                  <Marker
                    key={place.id}
                    identifier={place.id}
                    accessibilityLabel={`Map pin for ${place.name}`}
                    coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                    title={place.name}
                    description={label(categoryName(place.category))}
                    pinColor={selected?.id === place.id ? colors.red : pinColor(place.category)}
                    onPress={() => select(place)}
                  />
                ))}
            </MapView>
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
                onPress={() => fitPlaces(visible)}
                style={styles.mapButton}
              >
                <Text style={styles.link}>Fit</Text>
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
            {selected ? (
              <PlaceDetails
                key={selected.id}
                place={selected}
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
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    accessibilityLabel="Search places"
                    placeholder="Search places or recommendations"
                    placeholderTextColor={colors.muted}
                    value={query}
                    maxLength={200}
                    onFocus={() => setPanelExpanded(true)}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={[styles.input, styles.grow]}
                  />
                  {query !== '' && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                      onPress={() => setQuery('')}
                      style={styles.textButton}
                    >
                      <Text style={styles.link}>Clear</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Refresh places and saves"
                    onPress={() => {
                      setRefresh((value) => value + 1);
                      setSearchRetry((value) => value + 1);
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.link}>Refresh</Text>
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
                      onPress={() => setCategory(null)}
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
                          setCategory(category === item ? null : item);
                          setPanelExpanded(true);
                        }}
                        style={[styles.chip, category === item && styles.activeChip]}
                      >
                        <Text style={[styles.chipText, category === item && styles.activeText]}>
                          <Text
                            style={{ color: category === item ? colors.white : pinColor(item) }}
                          >
                            ●{' '}
                          </Text>
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
                ) : (
                  <FlatList
                    data={visible}
                    keyExtractor={(place) => place.id}
                    style={styles.grow}
                    contentContainerStyle={styles.cards}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    ListEmptyComponent={
                      <Text style={styles.empty}>
                        {searching
                          ? 'Searching recommendations…'
                          : places.length === 0
                            ? `No places in the catalog for ${city}. Change city or refresh.`
                            : savedOnly
                              ? 'No saved places match these filters.'
                              : 'No places match. Clear the search or change a category.'}
                      </Text>
                    }
                    renderItem={({ item: place }) => {
                      const match = matches.get(place.id),
                        reason = match?.reasons[0];
                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${place.name}`}
                          onPress={() => select(place)}
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
                          <Text style={styles.link}>
                            {savedPlaces.has(place.id) ? 'Saved ✓' : 'Details →'}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                )}
              </>
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
  },
  wordmark: {
    fontFamily: serif,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  title: { fontFamily: serif, color: colors.ink, fontSize: 27, fontWeight: '700' },
  modeLabel: { color: colors.muted, fontSize: 11, paddingHorizontal: 18, paddingBottom: 8 },
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
    height: 44,
    color: colors.ink,
    fontSize: 13,
  },
  filterRow: { height: 48 },
  chips: { paddingHorizontal: 14, gap: 7, paddingBottom: 6 },
  chip: {
    height: 40,
    borderRadius: 22,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  activeText: { color: colors.white },
  textButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  notice: { paddingHorizontal: 18, paddingVertical: 8 },
  error: { color: colors.red, fontSize: 13, lineHeight: 20 },
  mapArea: { flex: 1, minHeight: 0 },
  mapTools: { position: 'absolute', right: 12, top: 12, gap: 4, flexDirection: 'row' },
  mapButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  cardCategory: { color: colors.red, fontSize: 10, fontWeight: '600', marginBottom: 4 },
  cardTitle: { color: colors.ink, fontFamily: serif, fontSize: 19, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 10 },
});
