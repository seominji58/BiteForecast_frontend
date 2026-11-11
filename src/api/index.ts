import { request } from '@/api/client';
import type {
  FishingIndexDay,
  Trip,
  TripInput,
  TripListItem,
  TripOutlook,
  TripPatch,
  TripStopInput,
  TripStopPatch,
  Account,
  Agreements,
  AuthConfig,
  AuthResult,
  GoogleSignupNeeded,
  MergeInfo,
  CompareResult,
  DataSource,
  DateRange,
  Health,
  Journal,
  JournalInput,
  JournalMutation,
  MyPoints,
  MyTitle,
  Place,
  PlaceConditions,
  PlacesSummary,
  PostCategory,
  PostFilter,
  PostDetail,
  PostInput,
  PostSummary,
  ReportResult,
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
  requestVerification: (id: number) => request<Journal>(`/journals/${id}/verification`, { method: 'POST', auth: true }),
  cancelVerification: (id: number) => request<Journal>(`/journals/${id}/verification`, { method: 'DELETE', auth: true }),

  dateRange: () => request<DateRange>('/meta/date-range'),
  sources: () => request<DataSource[]>('/meta/sources'),
  placesSummary: (date: string) => request<PlacesSummary>(`/places-summary?date=${date}`),
  fishingIndex: (date: string) => request<FishingIndexDay>(`/fishing-index?date=${date}`),
  conditions: (placeId: number, date: string) =>
    request<PlaceConditions>(`/places/${placeId}/conditions?date=${date}`),
  compare: (placeA: number, placeB: number, date: string) =>
    request<CompareResult>(`/compare?place_a=${placeA}&place_b=${placeB}&date=${date}`),

  posts: (category: PostCategory | null, sort: 'latest' | 'popular', filter: PostFilter = {}) => {
    const qs = new URLSearchParams({ sort });
    if (category) qs.set('category', category);
    if (filter.sido) qs.set('sido', filter.sido);
    if (filter.species) qs.set('species', filter.species);
    return request<PostSummary[]>(`/community/posts?${qs.toString()}`);
  },
  favorites: () => request<Place[]>('/me/favorites'),

  // --- 출조계획 ---
  trips: (when: 'upcoming' | 'past') => request<TripListItem[]>(`/me/trips?when=${when}`, { auth: true }),
  trip: (id: number) => request<Trip>(`/me/trips/${id}`, { auth: true }),
  createTrip: (input: TripInput) => request<Trip>('/me/trips', { method: 'POST', body: input, auth: true }),
  updateTrip: (id: number, patch: TripPatch) =>
    request<Trip>(`/me/trips/${id}`, { method: 'PATCH', body: patch, auth: true }),
  deleteTrip: (id: number) => request<void>(`/me/trips/${id}`, { method: 'DELETE', auth: true }),
  addTripStop: (id: number, stop: TripStopInput) =>
    request<Trip>(`/me/trips/${id}/stops`, { method: 'POST', body: stop, auth: true }),
  updateTripStop: (id: number, stopId: number, patch: TripStopPatch) =>
    request<Trip>(`/me/trips/${id}/stops/${stopId}`, { method: 'PATCH', body: patch, auth: true }),
  deleteTripStop: (id: number, stopId: number) =>
    request<Trip>(`/me/trips/${id}/stops/${stopId}`, { method: 'DELETE', auth: true }),
  setTripChecklist: (id: number, items: { label: string; checked: boolean }[]) =>
    request<Trip>(`/me/trips/${id}/checklist`, { method: 'PUT', body: items, auth: true }),
  tripOutlook: (id: number) => request<TripOutlook>(`/me/trips/${id}/outlook`, { auth: true }),
  setFavorite: (placeId: number, on: boolean) =>
    request<void>(`/me/favorites/${placeId}`, { method: on ? 'PUT' : 'DELETE' }),
  post: (id: number) => request<PostDetail>(`/community/posts/${id}`, { auth: true }),
  createPost: (input: PostInput) => request<PostDetail>('/community/posts', { method: 'POST', body: input, auth: true }),
  deletePost: (id: number) => request<void>(`/community/posts/${id}`, { method: 'DELETE', auth: true }),
  addComment: (postId: number, body: string) =>
    request<PostDetail>(`/community/posts/${postId}/comments`, { method: 'POST', body: { body }, auth: true }),
  deleteComment: (id: number) => request<void>(`/community/comments/${id}`, { method: 'DELETE', auth: true }),
  setLike: (postId: number, liked: boolean) =>
    request<{ liked: boolean; like_count: number }>(`/community/posts/${postId}/like`, {
      method: liked ? 'PUT' : 'DELETE',
      auth: true,
    }),
  report: (targetType: 'post' | 'comment', targetId: number, reason: string) =>
    request<ReportResult>('/community/reports', {
      method: 'POST',
      body: { target_type: targetType, target_id: targetId, reason },
      auth: true,
    }),

  // --- 회원 ---
  authConfig: () => request<AuthConfig>('/auth/config'),
  signup: (b: { email: string; password: string; nickname: string; agreements: Agreements }) =>
    request<AuthResult>('/auth/signup', { method: 'POST', body: b }),
  login: (b: { email: string; password: string }) => request<AuthResult>('/auth/login', { method: 'POST', body: b }),
  google: (idToken: string) =>
    request<AuthResult | GoogleSignupNeeded>('/auth/google', { method: 'POST', body: { id_token: idToken } }),
  googleSignup: (b: { id_token: string; nickname: string; agreements: Agreements }) =>
    request<AuthResult>('/auth/google/signup', { method: 'POST', body: b }),
  nicknameCheck: (nickname: string) =>
    request<{ available: boolean; message: string | null }>(`/auth/nickname-check?nickname=${encodeURIComponent(nickname)}`),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  mergeDevice: () => request<MergeInfo>('/auth/merge-device', { method: 'POST' }),
  account: () => request<Account>('/me/account'),
  updateNickname: (nickname: string) => request<Account>('/me/account', { method: 'PATCH', body: { nickname } }),
  deleteAccount: () => request<void>('/me/account', { method: 'DELETE' }),

  myTitle: () => request<MyTitle>('/me/title', { auth: true }),
  myPoints: () => request<MyPoints>('/me/points', { auth: true }),
};

export { ApiError, API_URL } from '@/api/client';
export type * from '@/api/types';
