import type { PlaceSummary } from '@roami/shared';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, callApi } from '../api';
import { PlaceDetails } from './map/PlaceDetails';
import { PlaceMap } from './map/PlaceMap';
import { PlacesPanel } from './map/PlacesPanel';
import { colors } from './map/theme';
import { styles } from './map/mapStyles';
import { hasCoordinates } from './map/mapUtils';
import { usePlaces } from './map/usePlaces';
import { PlaceResults } from './map/PlaceResults';

const SEATTLE: Region = {
  latitude: 47.6087,
  longitude: -122.341,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};
const NO_PLACES: PlaceSummary[] = [];

interface Props {
  onSignOut: () => Promise<void>;
  requestedPlaceId?: string;
  requestedRecommendationId?: string;
  onPlaceRequestHandled?: () => void;
  savedRefreshKey?: number;
}

export function MapScreen({
  onSignOut,
  requestedPlaceId,
  requestedRecommendationId,
  onPlaceRequestHandled,
  savedRefreshKey = 0,
}: Props) {
  const map = useRef<MapView>(null);
  const lastFit = useRef('');
  const placeRequestVersion = useRef(0);
  const region = useRef(SEATTLE);
  const mapReady = useRef(false);
  const [city, setCity] = useState('Seattle');
  const data = usePlaces(city, savedRefreshKey);
  const {
    savedPlaces,
    saveAction,
    loading,
    error,
    searching,
    savedRefreshError,
    visible,
    pins,
    changeSaved,
    resetFilters,
  } = data;
  const [cityDraft, setCityDraft] = useState(city);
  const [editingCity, setEditingCity] = useState(false);
  const [selected, setSelected] = useState<PlaceSummary | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>();
  const [signOutError, setSignOutError] = useState('');
  const [placeRequestError, setPlaceRequestError] = useState('');
  const openingPlace = Boolean(requestedPlaceId);
  const [signingOut, setSigningOut] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(600);
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

  // A link identifies a place, not a city. Resolve it through the shared API.
  useEffect(() => {
    if (!requestedPlaceId) return;
    let active = true;
    const version = ++placeRequestVersion.current;
    callApi('getPlace', { placeId: requestedPlaceId })
      .then(({ place }) => {
        if (!active || version !== placeRequestVersion.current) return;
        setPlaceRequestError('');
        if (place.city) {
          setCity(place.city);
          setCityDraft(place.city);
        }
        resetFilters();
        setEditingCity(false);
        showPlace(place, requestedRecommendationId);
        onPlaceRequestHandled?.();
      })
      .catch((error: unknown) => {
        if (!active || version !== placeRequestVersion.current) return;
        setSelected(null);
        setPlaceRequestError(
          error instanceof ApiError && error.code === 'not-found'
            ? 'This place is no longer available.'
            : 'Could not open this place. Return to Postcards or Saved and try again.',
        );
        onPlaceRequestHandled?.();
      });
    return () => {
      active = false;
    };
  }, [requestedPlaceId, requestedRecommendationId, onPlaceRequestHandled, showPlace, resetFilters]);
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
    setSelected(null);
    resetFilters();
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
              <PlaceResults
                city={city}
                data={data}
                onInteract={cancelPlaceRequest}
                onExpand={() => setPanelExpanded(true)}
                onSelect={select}
              />
            )}
          </PlacesPanel>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
