import { request } from '@/api/client';
import type {
  Health,
  Journal,
  JournalInput,
  JournalMutation,
  MyPoints,
  MyTitle,
  Place,
  Region,
  Species,
} from '@/api/types';

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
  species: () => request<Species[]>('/species'),

  journals: () => request<Journal[]>('/journals', { auth: true }),
  journal: (id: number) => request<Journal>(`/journals/${id}`, { auth: true }),
  createJournal: (input: JournalInput) =>
    request<JournalMutation>('/journals', { method: 'POST', body: input, auth: true }),
  updateJournal: (id: number, input: JournalInput) =>
    request<JournalMutation>(`/journals/${id}`, { method: 'PUT', body: input, auth: true }),
  deleteJournal: (id: number) => request<JournalMutation>(`/journals/${id}`, { method: 'DELETE', auth: true }),

  myTitle: () => request<MyTitle>('/me/title', { auth: true }),
  myPoints: () => request<MyPoints>('/me/points', { auth: true }),
};

export { ApiError, API_URL } from '@/api/client';
export type * from '@/api/types';
