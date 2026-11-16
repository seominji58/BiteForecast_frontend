/** 예비 지도: react-native-maps (iOS 애플 지도 · Android 구글 지도). 카카오맵을 쓸 수 없을 때(Expo Go 등) */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { AppMapHandle, AppMapProps, MarkerTone } from '@/components/map/types';

export const TONE_COLOR: Record<MarkerTone, string> = {
  navy: '#0F2C4A',
  teal: '#0E5C63',
  gray: '#9AA5B1',
  danger: '#C62828',
  selected: '#F28C28',
};

export const RnMapsMap = forwardRef<AppMapHandle, AppMapProps>(function RnMapsMap(
  { initialRegion, markers, userLocation, onMarkerPress, onReady, onCameraIdle, style },
  ref,
) {
  const map = useRef<MapView>(null);
  useImperativeHandle(ref, () => ({
    moveTo: (r, ms = 300) => map.current?.animateToRegion(r, ms),
    fitTo: (pts) =>
      map.current?.fitToCoordinates(
        pts.map((p) => ({ latitude: p.lat, longitude: p.lon })),
        { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true },
      ),
  }));
  return (
    <MapView
      ref={map}
      style={style}
      initialRegion={initialRegion}
      showsUserLocation={!!userLocation}
      onMapReady={onReady}
      onRegionChangeComplete={(r) => onCameraIdle?.(r)}>
      {markers.map((m) =>
        m.count && m.count > 1 ? (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={m.label}
            onPress={() => onMarkerPress?.(m.id)}>
            <View style={[styles.group, { backgroundColor: TONE_COLOR[m.tone] }]}>
              <Text style={styles.groupText}>{m.count}</Text>
            </View>
          </Marker>
        ) : (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            pinColor={TONE_COLOR[m.tone]}
            title={m.label}
            onPress={() => onMarkerPress?.(m.id)}
          />
        ),
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  group: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  groupText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
