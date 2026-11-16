/**
 * 지도 공통 부품: 카카오맵을 기본으로 쓰고, 쓸 수 없으면(Expo Go·키 없음) react-native-maps 로.
 * EXPO_PUBLIC_MAP_PROVIDER=rnmaps 로 예비 지도를 강제할 수 있다 (카카오맵 문제 시 되돌리기용).
 */
import { forwardRef } from 'react';

import { KakaoMap, kakaoMapAvailable } from '@/components/map/provider-kakao';
import { RnMapsMap } from '@/components/map/provider-rnmaps';
import type { AppMapHandle, AppMapProps } from '@/components/map/types';

export type { AppMapHandle, AppMapProps, LatLon, MapMarker, MapRegion, MarkerTone } from '@/components/map/types';

export const MAP_PROVIDER: 'kakao' | 'rnmaps' =
  process.env.EXPO_PUBLIC_MAP_PROVIDER !== 'rnmaps' && kakaoMapAvailable() ? 'kakao' : 'rnmaps';

export const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap(props, ref) {
  return MAP_PROVIDER === 'kakao' ? <KakaoMap ref={ref} {...props} /> : <RnMapsMap ref={ref} {...props} />;
});
