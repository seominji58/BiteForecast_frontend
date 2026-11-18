/** 예비 지도: react-native-maps (iOS 애플 지도 · Android 구글 지도). 카카오맵을 쓸 수 없을 때(Expo Go 등) */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { BADGE_CATCH, PIN } from '@/components/map/pin-assets';
import type { AppMapHandle, AppMapProps, MarkerTone } from '@/components/map/types';

export const TONE_COLOR: Record<MarkerTone, string> = {
  navy: '#0F2C4A',
  teal: '#0E5C63',
  gray: '#9AA5B1',
  danger: '#C62828',
  selected: '#F28C28',
  catch: '#B8641A',
  good: '#22A05A',
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
        m.fish && PIN[m.fish] ? (
          // 어종 핀 (테두리 = 공식 지수 등급) + 조황 주황 점 + 아래 「좋음 12」 (카카오맵과 같은 규칙)
          <Marker
            key={`${m.id}-${m.ring}-${m.selected ? 1 : 0}-${m.caught ? 1 : 0}-${m.caption ?? ''}`}
            coordinate={{ latitude: m.lat, longitude: m.lon }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.4 }}
            accessibilityLabel={m.label}
            onPress={() => onMarkerPress?.(m.id)}>
            <View style={styles.pinWrap}>
              <Image source={PIN[m.fish][m.ring ?? 'normal']} style={m.selected ? styles.pinSel : styles.pin} />
              {m.caught ? <Image source={BADGE_CATCH} style={styles.catchDot} /> : null}
              {m.caption ? <Text style={styles.caption}>{m.caption}</Text> : null}
            </View>
          </Marker>
        ) : m.count && m.count > 1 ? (
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
  pinWrap: { alignItems: 'center' },
  pin: { width: 40, height: 40 },
  pinSel: { width: 52, height: 52 },
  catchDot: { position: 'absolute', top: 0, right: 0, width: 14, height: 14 },
  caption: { fontSize: 12, fontWeight: '800', color: '#0B2D4D', textShadowColor: '#FFFFFF', textShadowRadius: 3 },
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
