import type { Place, PlaceType } from '@/api/types';
import type { AppIconName } from '@/constants/icons';

/** 장소 유형별 이미지 아이콘 */
export const PLACE_IMAGE: Record<PlaceType, AppIconName> = {
  breakwater: 'place-breakwater',
  rock: 'place-rock',
  wharf: 'place-wharf',
  beach: 'place-beach',
  paid: 'place-wharf',
  point: 'place-rock',
  boat: 'place-wharf',
  other: 'place-breakwater',
};

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  breakwater: '방파제',
  rock: '갯바위',
  wharf: '항구',
  beach: '해변',
  paid: '유료 낚시터',
  point: '낚시 포인트',
  boat: '선상 포인트',
  other: '기타',
};

/** 「충남 태안군」 → 「충남」 */
export const sidoOf = (p: Place) => p.region_name.split(' ')[0];

/** 좌표 두 개 사이 직선거리(km). 좌표가 없으면 Infinity */
export function km(a: { lat: number | null; lon: number | null }, b: { lat: number | null; lon: number | null }): number {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return Infinity;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** 기준 장소에서 가까운 순 (기준 장소 포함) */
export function nearby(base: Place, all: Place[], n: number): { place: Place; km: number }[] {
  return all
    .map((p) => ({ place: p, km: km(base, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

/** 이름·지역·주소 검색 (공백으로 나눈 단어가 모두 들어간 장소) */
export function matches(p: Place, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${p.name} ${p.region_name} ${p.address ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
