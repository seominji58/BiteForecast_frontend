/**
 * 낚시터 길안내 주소 만들기 (2026-11-19).
 * - 카카오맵·네이버지도·T맵 앱 경로 안내(자동차)로 바로 연다. API 키 필요 없음
 * - 앱이 없으면 설치(앱스토어·플레이스토어) 또는 기기 기본 지도(iOS Apple 지도)를 고르게 한다
 *   (카카오맵 웹 길찾기는 「앱 설치」 안내 화면만 떠서 쓰지 않는다)
 * - 배를 타고 가는 바다 위 지점·섬/해역 지점은 차로 갈 수 없어 길안내를 만들지 않는다
 * - 좌표가 의심(D등급)이거나 없으면 경로 대신 주소·이름 검색으로만 연다
 */
import type { Place } from '@/api/types';

export type NavApp = 'kakao' | 'naver' | 'tmap';

export const NAV_APP_LABEL: Record<NavApp, string> = { kakao: '카카오맵', naver: '네이버 지도', tmap: 'T맵' };

const APP_ID = 'com.seominji58.biteforecast';

/** 설치 안내: [iOS 앱스토어, 안드로이드 플레이스토어] */
export const NAV_STORE: Record<NavApp, [string, string]> = {
  kakao: ['https://apps.apple.com/kr/app/id304608425', 'market://details?id=net.daum.android.map'],
  naver: ['https://apps.apple.com/kr/app/id311867728', 'market://details?id=com.nhn.android.nmap'],
  tmap: ['https://apps.apple.com/kr/app/id431589174', 'market://details?id=com.skt.tmap.ku'],
};
const enc = encodeURIComponent;

export type NavTarget =
  | { kind: 'route'; name: string; lat: number; lon: number }
  | { kind: 'search'; query: string }
  | { kind: 'none'; reason: string };

export function navTarget(p: Place, name: string): NavTarget {
  if (p.type === 'boat' || p.type === 'point') {
    return { kind: 'none', reason: '배를 타고 가는 바다 위 지점이라 길안내가 없어요. 출항 항구는 아래 「근처 낚시배」에 문의하세요.' };
  }
  if (p.lat != null && p.lon != null && !p.location_suspect) return { kind: 'route', name, lat: p.lat, lon: p.lon };
  const query = p.address ?? (p.name ? `${p.region_name} ${p.name}` : '');
  return query ? { kind: 'search', query } : { kind: 'none', reason: '주소·위치 정보가 없어 길안내를 할 수 없어요.' };
}

/** 그 앱의 길안내(경로) 또는 검색 주소 */
export function navUrl(app: NavApp, t: Exclude<NavTarget, { kind: 'none' }>): string {
  if (t.kind === 'search') {
    if (app === 'kakao') return `kakaomap://search?q=${enc(t.query)}`;
    if (app === 'naver') return `nmap://search?query=${enc(t.query)}&appname=${APP_ID}`;
    return `tmap://search?name=${enc(t.query)}`;
  }
  const { name, lat, lon } = t;
  if (app === 'kakao') return `kakaomap://route?ep=${lat},${lon}&by=CAR`;
  if (app === 'naver') return `nmap://route/car?dlat=${lat}&dlng=${lon}&dname=${enc(name)}&appname=${APP_ID}`;
  return `tmap://route?goalname=${enc(name)}&goalx=${lon}&goaly=${lat}`;
}

/** iOS 기본 지도(Apple 지도) — 앱이 하나도 없을 때 대신 */
export function appleMapsUrl(t: Exclude<NavTarget, { kind: 'none' }>): string {
  if (t.kind === 'search') return `https://maps.apple.com/?q=${enc(t.query)}`;
  return `https://maps.apple.com/?daddr=${t.lat},${t.lon}&q=${enc(t.name)}&dirflg=d`;
}
