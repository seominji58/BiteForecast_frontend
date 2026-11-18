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

/**
 * 정밀 위치 기반 기능(지도·거리순·가까운 곳·추천)에 쓸 수 있는지.
 * 좌표 오류 의심(D등급)은 뺀다 — 원본 데이터·일반 상세·검색에는 그대로 남는다
 */
export const usableForLocation = (p: Place) => !p.location_suspect && p.lat != null && p.lon != null;

/**
 * 위치 기반 「추천」(출조 후보·가까운 낚시터·비교 추천·조건에 맞는 곳)에 내도 되는지.
 * 좌표 불일치 의심(주소와 좌표의 시·군이 다름)은 검증 전까지 추천을 보류한다 — 지도·검색·상세에는 안내와 함께 남는다
 */
export const recommendable = (p: Place) => usableForLocation(p) && !p.coord?.recommend_hold;

/** 대략 위치(대표 주소·반올림·공유 좌표) — 실제 낚시 지점처럼 보여주지 않는다 */
export const isApprox = (p: Place | null | undefined) => !!p?.coord?.approx;

/** 거리 표시. 대략 위치면(대상 또는 기준 쪽 approx) 「약」을 붙이고 1km 단위로만 */
export function distLabel(d: number | null | undefined, p?: Place | null, approx = false): string | null {
  if (d == null || !Number.isFinite(d)) return null;
  if (approx || isApprox(p)) return d < 1.5 ? '약 1km 안팎' : `약 ${Math.round(d)}km`;
  return d < 1 ? '1km 미만' : `${Math.round(d)}km`;
}

/** 같은 좌표를 쓰는 낚시터 묶음 키 */
export const coordKey = (p: Place) => `${p.lat?.toFixed(6)},${p.lon?.toFixed(6)}`;

/** 기준 장소에서 가까운 순 (기준 장소 포함). 좌표 오류 의심 곳은 빼고, 기준이 의심 곳이면 비운다 */
export function nearby(base: Place, all: Place[], n: number): { place: Place; km: number }[] {
  if (!usableForLocation(base)) return [];
  return all
    .filter((p) => p.id === base.id || recommendable(p))
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

/**
 * 장소 표시 이름 (2026-11-18, 주변 플레이스 설계 1차). 원본 이름은 그대로 두고 화면에서만 바꾼다.
 * 국립해양조사원 바다낚시지수 「선상」 지점은 「목포북항서측(53km)」처럼 항구 기준 바다 위 좌표라
 * 사람이 가는 낚시터처럼 보이지 않게 「목포북항 서쪽 53km 바다」로 보여준다.
 */
const SEA_POINT = /^(.+?항)(북북동|북북서|남남동|남남서|동북동|동남동|서북서|서남서|북동|북서|남동|남서|북|남|동|서)(측)?\((\d+(?:\.\d+)?)km\)$/;

export function placeName(p: Pick<Place, 'name' | 'type'>): string {
  if (p.type !== 'boat') return p.name;
  const m = SEA_POINT.exec(p.name.trim());
  return m ? `${m[1]} ${m[2]}쪽 ${m[4]}km 바다` : p.name;
}

/** 장소 종류 안내 한 줄 (지수 지점만). 낚시터와 섞여 보이지 않게 */
export function placeKindNote(p: Pick<Place, 'type'>): string | null {
  if (p.type === 'boat') return '배를 타고 가는 바다 위 지점 · 공식 낚시지수 기준점';
  if (p.type === 'point') return '섬·해역 단위 지점 · 공식 낚시지수 기준점';
  return null;
}
