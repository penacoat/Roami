import type { Trip, TripStopView } from '@roami/shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { describeDayStops } from '../logic/stopDetails';
import { activityName } from './daySchedule';
import { itineraryStyles as controls } from './itineraryStyles';
import { formatTimeRange } from './stopTime';
import { StopInsights } from './StopInsights';
import { tripTheme } from './tripTheme';

export function ItineraryMap({
  stops,
  hours,
  onList,
}: {
  stops: TripStopView[];
  hours: Trip['dailyWindow'];
  onList: () => void;
}) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string>();
  const entries = useMemo(() => describeDayStops(stops), [stops]);
  const pins = useMemo(
    () =>
      entries.flatMap(({ stop }, index) => {
        const p = stop.place;
        if (
          !p ||
          !Number.isFinite(p.latitude) ||
          Math.abs(p.latitude) > 90 ||
          !Number.isFinite(p.longitude) ||
          Math.abs(p.longitude) > 180
        )
          return [];
        return [{ stop, index, coordinate: { latitude: p.latitude, longitude: p.longitude } }];
      }),
    [entries],
  );
  const selectedEntry = entries.find(({ stop }) => stop.id === selected) ?? entries[0];

  useEffect(() => {
    if (!ready || pins.length === 0) return;
    if (pins.length === 1) {
      map.current?.animateToRegion({
        ...pins[0].coordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });
    } else {
      map.current?.fitToCoordinates(
        pins.map((pin) => pin.coordinate),
        {
          edgePadding: { top: 55, right: 55, bottom: 55, left: 55 },
          animated: true,
        },
      );
    }
  }, [pins, ready]);

  return (
    <View style={{ gap: 10 }}>
      {pins.length && Platform.OS !== 'web' ? (
        <>
          <MapView
            testID="itinerary-map"
            ref={map}
            onMapReady={() => setReady(true)}
            style={styles.map}
            initialRegion={{ ...pins[0].coordinate, latitudeDelta: 0.07, longitudeDelta: 0.07 }}
          >
            {pins.map(({ stop, index, coordinate }) => (
              <Marker
                key={stop.id}
                coordinate={coordinate}
                title={activityName(stop)}
                description={`Stop ${index + 1}${stop.isRequired ? ' · Must-do' : ''}`}
                pinColor={selectedEntry?.stop.id === stop.id ? tripTheme.accent : tripTheme.ink}
                onPress={() => setSelected(stop.id)}
              />
            ))}
            {pins
              .slice(1)
              .map(
                (pin, index) =>
                  pin.index === pins[index].index + 1 && (
                    <Polyline
                      key={pin.stop.id}
                      coordinates={[pins[index].coordinate, pin.coordinate]}
                      strokeColor={tripTheme.ink}
                      strokeWidth={2}
                      lineDashPattern={[6, 6]}
                    />
                  ),
              )}
          </MapView>
          {pins.length > 1 && (
            <Text style={controls.muted}>Lines show stop order. Check the walking route.</Text>
          )}
        </>
      ) : (
        <Text style={controls.muted}>
          {pins.length
            ? 'Map previews are available in the mobile app.'
            : 'No mapped places on this day.'}
        </Text>
      )}
      <View style={controls.wrap}>
        {entries.map(({ stop }, index) => (
          <Pressable
            key={stop.id}
            accessibilityRole="button"
            accessibilityLabel={`Show ${activityName(stop)} on map`}
            accessibilityState={{ selected: selectedEntry?.stop.id === stop.id }}
            style={[controls.button, selectedEntry?.stop.id === stop.id && controls.selected]}
            onPress={() => {
              setSelected(stop.id);
              const pin = pins.find((item) => item.stop.id === stop.id);
              if (pin && ready) map.current?.animateCamera({ center: pin.coordinate });
            }}
          >
            <Text style={controls.buttonText}>
              {index + 1}. {activityName(stop)}
            </Text>
          </Pressable>
        ))}
      </View>
      {selectedEntry && (
        <View style={controls.card}>
          <Text style={controls.text}>{activityName(selectedEntry.stop)}</Text>
          <Text style={controls.muted}>
            {selectedEntry.stop.startTime
              ? formatTimeRange(selectedEntry.stop.startTime, selectedEntry.stop.visitMinutes)
              : 'Unscheduled'}
            {selectedEntry.stop.isFixed
              ? ' · Fixed'
              : selectedEntry.stop.isRequired
                ? ' · Must-do'
                : ''}
          </Text>
          <StopInsights entry={selectedEntry} hours={hours} />
          <Pressable accessibilityRole="button" style={controls.button} onPress={onList}>
            <Text style={controls.buttonText}>Show in day list</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ map: { height: 310, borderRadius: 10, overflow: 'hidden' } });
