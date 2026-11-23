import type { CityLocation, PlaceSummary } from '@roami/shared';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, callApi } from '../api';
import { useCity, nearCity } from '../cities/CityProvider';
import { CitySelector } from '../cities/CitySelector';
import { PlaceDetails } from './map/PlaceDetails';
import { PlaceMap } from './map/PlaceMap';
import { PlacesPanel } from './map/PlacesPanel';
import { colors } from './map/theme';
import { styles } from './map/mapStyles';
import { hasCoordinates } from './map/mapUtils';
import { usePlaces } from './map/usePlaces';
import { PlaceResults } from './map/PlaceResults';

const NO_PLACES: PlaceSummary[] = [];

interface Props {
  requestedPlaceId?: string;
  requestedRecommendationId?: string;
  onPlaceRequestHandled?: () => void;
  savedRefreshKey?: number;
}

export function MapScreen({
  requestedPlaceId,
  requestedRecommendationId,
  onPlaceRequestHandled,
  savedRefreshKey = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const lastFit = useRef('');
  const placeRequestVersion = useRef(0);
  const { city: selectedCity, setCity } = useCity();
  const city = selectedCity.name;
  const cityRegion = useMemo(
    () => ({
      latitude: selectedCity.latitude,
      longitude: selectedCity.longitude,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }),
    [selectedCity],
  );
  const region = useRef(cityRegion);
  const mapReady = useRef(false);
  const data = usePlaces(city, savedRefreshKey, selectedCity);
  const {
    savedPlaces,
    saveAction,
    loading,
    searching,
    savedRefreshError,
    visible,
    pins,
    changeSaved,
    resetFilters,
  } = data;
  const [selected, setSelected] = useState<PlaceSummary | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>();
  const [placeRequestError, setPlaceRequestError] = useState('');
  const openingPlace = Boolean(requestedPlaceId);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(600);
  const panelHeight = Math.max(0, availableHeight - insets.top);
  const mapPlaces = useMemo(() => {
    const currentPins = !loading || data.refreshing ? pins : NO_PLACES;
    return selected && hasCoordinates(selected)
      ? [selected, ...currentPins.filter((place) => place.id !== selected.id)]
      : currentPins;
  }, [pins, selected, loading, data.refreshing]);
  const initialMapRegion = useMemo(() => {
    const first = mapPlaces[0];
    return first
      ? {
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: selected ? 0.008 : 0.06,
          longitudeDelta: selected ? 0.008 : 0.06,
        }
      : cityRegion;
  }, [mapPlaces, selected, cityRegion]);
  const showMap = true;
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
      if (data.query.trim() || data.category || data.savedOnly) fitPlaces(visible);
      lastFit.current = fitKey;
    }
  }, [
    visible,
    loading,
    searching,
    selected,
    fitKey,
    fitPlaces,
    data.query,
    data.category,
    data.savedOnly,
  ]);

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
    else map.current?.animateToRegion(region.current, 300);
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
          setCity((current) =>
            current.name === place.city && nearCity(place, current)
              ? current
              : {
                  id: `place-city:${place.city}:${place.latitude}:${place.longitude}`,
                  name: place.city!,
                  region: '',
                  country: '',
                  latitude: place.latitude,
                  longitude: place.longitude,
                },
          );
        }
        resetFilters();
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
  }, [
    requestedPlaceId,
    requestedRecommendationId,
    onPlaceRequestHandled,
    showPlace,
    resetFilters,
    setCity,
  ]);
  function zoom(factor: number) {
    cancelPlaceRequest();
    region.current = {
      ...region.current,
      latitudeDelta: Math.max(0.0005, Math.min(140, region.current.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.0005, Math.min(180, region.current.longitudeDelta * factor)),
    };
    map.current?.animateToRegion(region.current, 200);
  }
  const [lastCityId, setLastCityId] = useState(selectedCity.id);
  if (lastCityId !== selectedCity.id) {
    setLastCityId(selectedCity.id);
    resetFilters();
    if (!selected || selected.city !== city || !nearCity(selected, selectedCity)) {
      setSelected(null);
      setPanelExpanded(false);
    }
  }
  const previousCity = useRef(selectedCity.id);
  useEffect(() => {
    if (previousCity.current === selectedCity.id) return;
    previousCity.current = selectedCity.id;
    const place = mapState.current.selected;
    if (place && place.city === selectedCity.name && nearCity(place, selectedCity)) return;
    region.current = cityRegion;
    map.current?.animateToRegion(cityRegion, 450);
  }, [selectedCity, cityRegion]);
  function chooseCity(next: CityLocation) {
    cancelPlaceRequest();
    setCity(next);
    setSelected(null);
    setPanelExpanded(false);
    resetFilters();
    region.current = {
      latitude: next.latitude,
      longitude: next.longitude,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
    if (next.id === selectedCity.id) map.current?.animateToRegion(region.current, 450);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {savedRefreshError !== '' && (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>
              {savedRefreshError}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={data.refreshPlaces}
              style={styles.textButton}
            >
              <Text style={styles.link}>Retry saved status</Text>
            </Pressable>
          </View>
        )}
        {placeRequestError !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {placeRequestError}
          </Text>
        )}
        <View
          style={[styles.grow, styles.mapCanvas]}
          onLayout={({ nativeEvent }) => {
            if (nativeEvent.layout.height > 0) setAvailableHeight(nativeEvent.layout.height);
          }}
        >
          <View style={styles.mapArea}>
            {showMap && (
              <PlaceMap
                mapRef={map}
                places={mapPlaces}
                selectedId={selected?.id}
                initialRegion={initialMapRegion}
                bottomInset={Math.min(280, panelHeight * 0.58)}
                onReady={handleMapReady}
                onRegionChange={handleRegionChange}
                onSelect={select}
              />
            )}
            {showMap && Platform.OS !== 'web' && (
              <View style={[styles.mapTools, { top: insets.top + 12 }]}>
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
            )}
            {!loading && pins.length < visible.length && (
              <View style={styles.mapNotice}>
                <Text style={styles.caption}>
                  {visible.length - pins.length} places have no map location.
                </Text>
              </View>
            )}
          </View>
          <PlacesPanel
            availableHeight={panelHeight}
            expanded={panelExpanded}
            onExpandedChange={setPanelExpanded}
            onBack={selected ? () => setSelected(null) : undefined}
            citySelector={
              !selected && (
                <CitySelector
                  city={selectedCity}
                  onSelect={chooseCity}
                  onOpen={cancelPlaceRequest}
                />
              )
            }
            title={
              selected
                ? 'Back to places'
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
                onSave={(recommendationId) =>
                  void changeSaved(selected.id, false, recommendationId)
                }
                onUnsave={() => void changeSaved(selected.id, true)}
                onRemoveRecommendation={(id) => void changeSaved(selected.id, true, id)}
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
