import { useQuery } from '@tanstack/react-query';

import { api } from '@/api';

// 화면에서 쓰는 조회 훅. queryKey 는 캐시 무효화 기준이 되므로 여기서만 정의한다.
export const queryKeys = {
  health: ['health'] as const,
  places: (q?: string, regionId?: number) => ['places', { q, regionId }] as const,
  myTitle: ['me', 'title'] as const,
};

export const useHealth = () => useQuery({ queryKey: queryKeys.health, queryFn: api.health });

export const usePlaces = (q?: string, regionId?: number) =>
  useQuery({ queryKey: queryKeys.places(q, regionId), queryFn: () => api.places({ q, regionId }) });

export const useMyTitle = () => useQuery({ queryKey: queryKeys.myTitle, queryFn: api.myTitle });
