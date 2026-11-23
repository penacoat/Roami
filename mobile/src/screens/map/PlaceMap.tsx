import type { PlaceSummary } from '@roami/shared';
import React, { memo, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { colors } from './theme';

interface Props {
  mapRef: RefObject<MapView | null>;
  places: PlaceSummary[];
  selectedId?: string;
  initialRegion: Region;
  bottomInset: number;
  onReady: () => void;
  onRegionChange: (region: Region) => void;
  onSelect: (place: PlaceSummary) => void;
}

// Keep native map updates separate from search input, sheets, and save feedback.
export const PlaceMap = memo(function PlaceMap({
  mapRef,
  places,
  selectedId,
  initialRegion,
  bottomInset,
  onReady,
  onRegionChange,
  onSelect,
}: Props) {
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      mapPadding={{ top: 12, left: 12, right: 12, bottom: bottomInset }}
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onMapReady={onReady}
      onRegionChangeComplete={onRegionChange}
    >
      {places.map((place) => (
        <Marker
          key={place.id}
          identifier={place.id}
          accessibilityLabel={`Map pin for ${place.name}`}
          coordinate={{ latitude: place.latitude, longitude: place.longitude }}
          pinColor={selectedId === place.id ? colors.red : colors.primary}
          tracksViewChanges={false}
          onPress={() => onSelect(place)}
        />
      ))}
    </MapView>
  );
});
