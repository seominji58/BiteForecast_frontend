import { request } from '@/api/client';
import type { Health, MyTitle, Place, Region } from '@/api/types';

export const api = {
  health: () => request<Health>('/health'),
  regions: () => request<Region[]>('/regions'),
  places: (params: { q?: string; regionId?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.regionId != null) qs.set('region_id', String(params.regionId));
    const s = qs.toString();
    return request<Place[]>(`/places${s ? `?${s}` : ''}`);
  },
  myTitle: () => request<MyTitle>('/me/title', { auth: true }),
};

export { ApiError, API_URL } from '@/api/client';
export type * from '@/api/types';
