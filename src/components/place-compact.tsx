/**
 * 낚시터 상세 「주변」 한 줄의 시설 요약 (2026-11-23). 전체 목록(근처 낚시터·전화·지도)은 「주변」 시트에서.
 */

import { useAmenities, useNearbyShops } from '@/api/queries';

const km = (m: number) => (m < 1000 ? `${m}m` : `${Number((m / 1000).toFixed(1))}km`);

type Item = { name: string; distance_m: number };

/** 주변 시설 한 줄 요약 글: 「낚시점 935m · 편의점 724m · 주차장 564m」 (가까운 순 3개, 없는 종류는 뺌) */
export function useNearbyLine(placeId: number): string | null {
  const shops = useNearbyShops(placeId);
  const am = useAmenities(placeId);
  if (shops.data?.skipped ?? am.data?.skipped) return null;
  const cats: [string, Item[] | undefined][] = [
    ['낚시점', shops.data?.shops],
    ['편의점', am.data?.stores],
    ['주차장', am.data?.parking],
    ['화장실', am.data?.toilets],
    ['낚시배', shops.data?.boats],
  ];
  const parts = cats.flatMap(([label, items]) => (items?.length ? [`${label} ${km(items[0].distance_m)}`] : []));
  return parts.length ? parts.slice(0, 3).join(' · ') : null;
}
