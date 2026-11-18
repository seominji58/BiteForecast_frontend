/**
 * 낚시터 길안내 주소 만들기 (2026-11-19).
 * - 카카오맵·네이버지도·T맵 앱 경로 안내(자동차)로 바로 연다. API 키 필요 없음
 * - 앱이 없으면 카카오맵 웹 길찾기로 연다
 * - 배를 타고 가는 바다 위 지점·섬/해역 지점은 차로 갈 수 없어 길안내를 만들지 않는다
 * - 좌표가 의심(D등급)이거나 없으면 경로 대신 주소·이름 검색으로만 연다
 */
import type { Place } from '@/api/types';

export type NavApp = 'kakao' | 'naver' | 'tmap';

export const NAV_APP_LABEL: Record<NavApp, string> = { kakao: '카카오맵', naver: '네이버 지도', tmap: 'T맵' };

const APP_ID = 'com.seominji58.biteforecast';
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

/** [앱 주소, 앱이 없을 때 웹 주소] */
export function navUrls(app: NavApp, t: Exclude<NavTarget, { kind: 'none' }>): [string, string] {
  if (t.kind === 'search') {
    const web = `https://map.kakao.com/?q=${enc(t.query)}`;
    if (app === 'kakao') return [`kakaomap://search?q=${enc(t.query)}`, web];
    if (app === 'naver') return [`nmap://search?query=${enc(t.query)}&appname=${APP_ID}`, `https://map.naver.com/p/search/${enc(t.query)}`];
    return [`tmap://search?name=${enc(t.query)}`, web];
  }
  const { name, lat, lon } = t;
  const web = `https://map.kakao.com/link/to/${enc(name)},${lat},${lon}`;
  if (app === 'kakao') return [`kakaomap://route?ep=${lat},${lon}&by=CAR`, web];
  if (app === 'naver') return [`nmap://route/car?dlat=${lat}&dlng=${lon}&dname=${enc(name)}&appname=${APP_ID}`, web];
  return [`tmap://route?goalname=${enc(name)}&goalx=${lon}&goaly=${lat}`, web];
}
