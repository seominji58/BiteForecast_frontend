/**
 * 카카오맵 (@react-native-kakao/map). 개발용·배포 빌드에서만 동작한다 (Expo Go 없음).
 * - 마커는 카카오 「라벨」: 색 원 이미지 + (묶음이면) 가운데 숫자 글자. RN 뷰는 마커로 쓸 수 없다
 * - 위도 폭(delta) ↔ 줌 레벨은 여기서 바꾼다
 * - 카카오 콘솔에서 「카카오맵 사용 설정」이 켜져 있어야 지도가 그려진다.
 *   인증 실패(403 등)나 초기화 실패면 빈 화면 대신 예비 지도(react-native-maps)로 바꿔 보여준다
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { RnMapsMap } from '@/components/map/provider-rnmaps';
import { BADGE_CATCH, PIN, type PinRing } from '@/components/map/pin-assets';
import type { AppMapHandle, AppMapProps, MarkerTone } from '@/components/map/types';

type KakaoMapModule = typeof import('@react-native-kakao/map');
let mod: KakaoMapModule | null = null;
try {
  mod = require('@react-native-kakao/map') as KakaoMapModule;
} catch {
  mod = null;
}

const APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
let ready: Promise<void> | null = null;

/** 이 빌드에서 카카오맵을 쓸 수 있는지 (네이티브 모듈 + 앱 키) */
export function kakaoMapAvailable(): boolean {
  return !!mod && !!APP_KEY;
}

function init(): Promise<void> {
  if (!mod || !APP_KEY) return Promise.reject(new Error('카카오맵을 쓸 수 없는 빌드예요'));
  ready ??= mod.initializeKakaoMapSDK(APP_KEY).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** 보이는 위도 폭 → 카카오 줌 레벨 (구글 지도와 같은 단위로 맞춤, 6~20) */
export function deltaToZoom(delta: number): number {
  return Math.max(6, Math.min(20, Math.round(Math.log2(360 / Math.max(delta, 0.0005)))));
}

/** 줌 레벨 → 보이는 위도 폭 (deltaToZoom 의 반대) */
export function zoomToDelta(zoom: number): number {
  return 360 / 2 ** zoom;
}

const TONES: MarkerTone[] = ['navy', 'teal', 'gray', 'danger', 'selected', 'catch', 'good'];
const asset = (src: number, size: number) => ({
  uri: Image.resolveAssetSource(src)?.uri ?? '',
  width: size,
  height: size,
});
const DOT: Record<MarkerTone, number> = {
  navy: require('@/assets/map/dot-navy.png'),
  teal: require('@/assets/map/dot-teal.png'),
  gray: require('@/assets/map/dot-gray.png'),
  danger: require('@/assets/map/dot-danger.png'),
  selected: require('@/assets/map/dot-selected.png'),
  catch: require('@/assets/map/dot-catch.png'),
  good: require('@/assets/map/dot-good.png'),
};
const GROUP: Record<MarkerTone, number> = {
  navy: require('@/assets/map/group-navy.png'),
  teal: require('@/assets/map/group-teal.png'),
  gray: require('@/assets/map/group-gray.png'),
  danger: require('@/assets/map/group-danger.png'),
  selected: require('@/assets/map/group-selected.png'),
  catch: require('@/assets/map/group-catch.png'),
  good: require('@/assets/map/group-good.png'),
};
const ME = require('@/assets/map/me.png');
/** (예전) 어종 그림 핀 — 공식 지수 8종, 초록 테두리. 새 핀은 PIN (scripts/make_map_pins.py) */
const FISH: Record<string, number> = {
  rockfish: require('@/assets/map/fish-rockfish.png'),
  black_porgy: require('@/assets/map/fish-black_porgy.png'),
  seabass: require('@/assets/map/fish-seabass.png'),
  rock_bream: require('@/assets/map/fish-rock_bream.png'),
  opaleye: require('@/assets/map/fish-opaleye.png'),
  red_seabream: require('@/assets/map/fish-red_seabream.png'),
  black_rockfish: require('@/assets/map/fish-black_rockfish.png'),
  red_rockfish: require('@/assets/map/fish-red_rockfish.png'),
};

const LAYER = 'places';
const ME_LAYER = 'me';

export const KakaoMap = forwardRef<AppMapHandle, AppMapProps>(function KakaoMap(
  { initialRegion, markers, userLocation, onMarkerPress, onReady, onCameraIdle, style },
  ref,
) {
  const [sdkReady, setSdkReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // 카카오맵은 처음에 자체 기본 위치(판교)를 잠깐 그린다 → 준비되고 우리 위치로 옮긴 뒤에 보여준다
  const [shown, setShown] = useState(false);
  const map = useRef<import('@react-native-kakao/map').KakaoMapViewRef>(null);
  const fallback = useRef<AppMapHandle>(null);

  useEffect(() => {
    let alive = true;
    init().then(
      () => alive && setSdkReady(true),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  useImperativeHandle(
    ref,
    () =>
      failed || !mod
        ? {
            moveTo: (r, ms) => fallback.current?.moveTo(r, ms),
            fitTo: (pts) => fallback.current?.fitTo(pts),
          }
        : {
            moveTo: (r, ms = 300) =>
              void map.current
                ?.moveCamera(
                  {
                    latitude: r.latitude,
                    longitude: r.longitude,
                    zoomLevel: deltaToZoom(r.latitudeDelta),
                  },
                  { duration: ms },
                )
                .catch(() => undefined),
            fitTo: (pts) =>
              void map.current
                ?.updateCamera(
                  {
                    type: 'fit',
                    coordinates: pts.map((p) => ({
                      latitude: p.lat,
                      longitude: p.lon,
                    })),
                  },
                  { duration: 300 },
                )
                .catch(() => undefined),
          },
    [failed],
  );

  const scene = useMemo(() => {
    const styles = [
      ...TONES.map((t) => ({
        id: `dot-${t}`,
        levels: [{ level: 0, image: asset(DOT[t], 25), anchor: { x: 0.5, y: 0.5 } }],
      })),
      ...TONES.map((t) => ({
        id: `group-${t}`,
        levels: [
          {
            level: 0,
            image: asset(GROUP[t], 37),
            anchor: { x: 0.5, y: 0.5 },
            textLayout: 'center' as const,
            textLines: [{ fontSize: 13, color: '#FFFFFF' }],
          },
        ],
      })),
      ...Object.entries(FISH).map(([code, src]) => ({
        id: `fish-${code}`,
        levels: [{ level: 0, image: asset(src, 44), anchor: { x: 0.5, y: 0.5 } }],
      })),
      // 어종 핀 × 테두리 색. 묶음이면 핀 아래에 「좋음 12」 글자
      ...Object.entries(PIN).flatMap(([code, rings]) =>
        (Object.keys(rings) as PinRing[]).map((ring) => ({
          id: `pin-${code}-${ring}`,
          levels: [
            {
              level: 0,
              image: asset(rings[ring], 40),
              anchor: { x: 0.5, y: 0.5 },
              textLayout: 'bottom' as const,
              textLines: [{ fontSize: 12, color: '#0B2D4D', strokeColor: '#FFFFFF', strokeWidth: 3 }],
            },
          ],
        })),
      ),
      {
        id: 'me',
        levels: [{ level: 0, image: asset(ME, 30), anchor: { x: 0.5, y: 0.5 } }],
      },
    ];
    const catchBadge = { id: 'catch', image: asset(BADGE_CATCH, 14), offset: { x: 0.9, y: 0.1 }, zOrder: 1 };
    const labels: import('@react-native-kakao/map').MapLabel[] = markers.map((m) => {
      const pin = m.fish && PIN[m.fish] ? `pin-${m.fish}-${m.ring ?? 'normal'}` : null;
      const styleId = pin ?? (m.count && m.count > 1 ? `group-${m.tone}` : m.fish && FISH[m.fish] ? `fish-${m.fish}` : `dot-${m.tone}`);
      const text = pin ? (m.caption ? [{ value: m.caption }] : undefined) : m.count && m.count > 1 ? [{ value: String(m.count) }] : undefined;
      return {
        id: m.id,
        layerId: LAYER,
        styleId,
        coordinate: { latitude: m.lat, longitude: m.lon },
        text,
        // 고른 곳 → 좋음 → 특보 → 조황 순으로 위에
        rank: m.selected || m.tone === 'selected' ? 1000 : m.ring === 'good' ? 80 : m.tone === 'danger' ? 100 : m.fish ? 60 : m.tone === 'catch' ? 50 : 1,
        clickable: true,
        // 고른 핀은 색을 바꾸지 않고 크게
        scale: m.selected ? { x: 1.3, y: 1.3 } : undefined,
        badges: m.caught ? [catchBadge] : undefined,
      };
    });
    if (userLocation)
      labels.push({
        id: '__me__',
        layerId: ME_LAYER,
        styleId: 'me',
        coordinate: { latitude: userLocation.lat, longitude: userLocation.lon },
        text: undefined,
        rank: 2000,
        clickable: false,
      });
    return {
      styles,
      // 겹쳐도 모두 보이게 (가까운 낚시터 핀이 서로 가리지 않도록 경쟁 없음)
      layers: [
        { id: LAYER, clickable: true, competition: 'none' as const, zOrder: 1 },
        {
          id: ME_LAYER,
          clickable: false,
          competition: 'none' as const,
          zOrder: 2,
        },
      ],
      labels,
    };
  }, [markers, userLocation]);

  // 카카오맵을 쓸 수 없으면 예비 지도로 (같은 마커·같은 ref 동작)
  if (failed || !mod)
    return (
      <RnMapsMap
        ref={fallback}
        style={style}
        initialRegion={initialRegion}
        markers={markers}
        userLocation={userLocation}
        onMarkerPress={onMarkerPress}
        onReady={onReady}
        onCameraIdle={onCameraIdle}
      />
    );
  if (!sdkReady) return <View style={[style, styles.empty]} />;
  const KakaoMapView = mod.KakaoMapView;
  return (
    <KakaoMapView
      ref={map}
      style={[style, !shown && styles.hidden]}
      initialCamera={{
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
        zoomLevel: deltaToZoom(initialRegion.latitudeDelta),
      }}
      options={{ poi: { visible: true, clickable: false } }}
      labels={scene}
      onMapReady={() => {
        void map.current
          ?.moveCamera(
            {
              latitude: initialRegion.latitude,
              longitude: initialRegion.longitude,
              zoomLevel: deltaToZoom(initialRegion.latitudeDelta),
            },
            { duration: 0 },
          )
          .catch(() => undefined)
          .finally(() => setTimeout(() => setShown(true), 120));
        onReady?.();
      }}
      onError={(e) => {
        if (__DEV__) console.warn('[카카오맵]', e.code, e.message);
        setFailed(true);
      }}
      onLabelClick={(e) => e.id !== '__me__' && onMarkerPress?.(e.id)}
      onCameraIdle={(e) => {
        const d = zoomToDelta(e.camera.zoomLevel);
        onCameraIdle?.({ latitude: e.camera.latitude, longitude: e.camera.longitude, latitudeDelta: d, longitudeDelta: d });
      }}
    />
  );
});

const styles = StyleSheet.create({
  empty: { backgroundColor: '#E6ECF1' },
  hidden: { opacity: 0 },
});
