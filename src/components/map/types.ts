/**
 * 지도 공통 부품 타입 (소셜 로그인·지도 SDK 설계 §2). 화면은 지도 라이브러리를 몰라도 되게 이 모양만 쓴다.
 * 좌표 범위는 「위도·경도 폭(delta)」으로 받고, 카카오맵(줌 레벨)으로는 부품 안에서 바꾼다.
 */
/** catch: 최근 이용자 조황이 있는 낚시터 (남색 + 주황 테두리) · good: 고른 어종 공식 지수 좋음 이상 (초록) */
export type MarkerTone = 'navy' | 'teal' | 'gray' | 'danger' | 'selected' | 'catch' | 'good';

export type MapMarker = {
  id: string;
  lat: number;
  lon: number;
  tone: MarkerTone;
  /** 같은 좌표 묶음이면 낚시터 수 (원 안에 숫자) */
  count?: number;
  /** 접근성·제목 */
  label?: string;
  /**
   * 어종 그림 핀 (어종 코드, 예: rockfish). 어종을 고르면 남은 핀이 모두 어종 그림이 된다 (지도 핀 설계 1단계, 2026-11-18)
   * 테두리 색(ring) = 고른 어종 공식 낚시지수: good 좋음 이상 · normal 보통/정보 없음 · bad 나쁨 이하 또는 해상특보
   */
  fish?: string;
  ring?: 'good' | 'normal' | 'bad';
  /** 최근 14일 이용자 조황이 있음 → 핀 오른쪽 위 주황 점 */
  caught?: boolean;
  /** 고른 핀: 색을 바꾸지 않고 크게 (주황은 「조황」 표시와 겹치므로 쓰지 않는다) */
  selected?: boolean;
  /** 핀 아래 글자 (어종 묶음의 「좋음 12」 등) */
  caption?: string;
};

export type MapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type LatLon = { lat: number; lon: number };

export type AppMapHandle = {
  /** 한 곳으로 이동 (delta = 보이는 위도 폭) */
  moveTo: (region: MapRegion, durationMs?: number) => void;
  /** 여러 곳이 모두 보이게 */
  fitTo: (points: LatLon[]) => void;
};

export type AppMapProps = {
  initialRegion: MapRegion;
  markers: MapMarker[];
  /** 현재 위치 점 (위치 권한을 허용했을 때만) */
  userLocation?: LatLon | null;
  onMarkerPress?: (id: string) => void;
  onReady?: () => void;
  /** 이동·확대가 멈췄을 때 보이는 범위 (마커 묶음 계산용) */
  onCameraIdle?: (region: MapRegion) => void;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
};
