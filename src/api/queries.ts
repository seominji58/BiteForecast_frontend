import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import type { JournalInput, PostCategory, PostFilter, PostInput, Trip } from '@/api/types';
import { useAuth } from '@/lib/auth';

// 화면에서 쓰는 조회/변경 훅. queryKey 는 캐시 무효화 기준이 되므로 여기서만 정의한다.
export const queryKeys = {
  health: ['health'] as const,
  places: (q?: string, regionId?: number) => ['places', { q, regionId }] as const,
  species: ['species'] as const,
  journals: ['journals'] as const,
  journal: (id: number) => ['journals', id] as const,
  me: ['me'] as const,
  myTitle: ['me', 'title'] as const,
  myPoints: ['me', 'points'] as const,
};

export const useHealth = () => useQuery({ queryKey: queryKeys.health, queryFn: api.health });

export const usePlaces = (q?: string, regionId?: number) =>
  useQuery({ queryKey: queryKeys.places(q, regionId), queryFn: () => api.places({ q, regionId }) });

export const useSpecies = () =>
  useQuery({ queryKey: queryKeys.species, queryFn: api.species, staleTime: Infinity });

/** 내 기록·포인트·칭호는 로그인했을 때만 불러온다 (손님이면 401 대신 요청 안 함) */
export const useJournals = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: queryKeys.journals, queryFn: api.journals, enabled: signedIn });
};

export const useJournal = (id: number) => {
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: queryKeys.journal(id),
    queryFn: () => api.journal(id),
    enabled: signedIn && Number.isFinite(id),
  });
};

export const useRegions = () => useQuery({ queryKey: ['regions'], queryFn: api.regions });

// 오늘 날짜는 자정에 바뀐다 — 앱을 켜 둔 채 날이 바뀌어도 따라가게 10분마다 확인
export const useDateRange = () =>
  useQuery({ queryKey: ['meta', 'date-range'], queryFn: api.dateRange, refetchInterval: 10 * 60_000 });

export const useCompare = (placeA: number, placeB: number, date: string) =>
  useQuery({
    queryKey: ['compare', placeA, placeB, date],
    queryFn: () => api.compare(placeA, placeB, date),
    enabled: Number.isFinite(placeA) && Number.isFinite(placeB) && !!date,
  });

export const useConditions = (placeId: number | null, date: string | undefined) =>
  useQuery({
    queryKey: ['conditions', placeId, date],
    queryFn: () => api.conditions(placeId!, date!),
    enabled: placeId != null && !!date,
  });

/** 전체 낚시터 요약 (서버 10분 캐시) */
/** 그날 공식 낚시지수 (홈 어종 탐색) */
export const useFishingIndex = (date: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ['fishing-index', date],
    queryFn: () => api.fishingIndex(date!),
    enabled: !!date && enabled,
    staleTime: 10 * 60_000,
  });

export const usePlacesSummary = (date: string | undefined) =>
  useQuery({
    queryKey: ['places-summary', date],
    queryFn: () => api.placesSummary(date!),
    enabled: !!date,
    staleTime: 5 * 60_000,
  });

export const useSources = () => useQuery({ queryKey: ['meta', 'sources'], queryFn: api.sources, staleTime: Infinity });

export const useMyTitle = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: queryKeys.myTitle, queryFn: api.myTitle, enabled: signedIn });
};

export const useMyPoints = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: queryKeys.myPoints, queryFn: api.myPoints, enabled: signedIn });
};

export const useAuthConfig = () =>
  useQuery({ queryKey: ['auth', 'config'], queryFn: api.authConfig, staleTime: 10 * 60_000 });

/** 일지가 바뀌면 일지 목록과 포인트·칭호를 함께 갱신한다 */
function useInvalidateJournalData() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.journals }),
      qc.invalidateQueries({ queryKey: queryKeys.me }),
      // 출조계획 장소에 붙은 기록 수
      qc.invalidateQueries({ queryKey: ['trips'] }),
    ]);
}

export function useSaveJournal(id?: number) {
  const invalidate = useInvalidateJournalData();
  return useMutation({
    mutationFn: (input: JournalInput) => (id != null ? api.updateJournal(id, input) : api.createJournal(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteJournal(id: number) {
  const invalidate = useInvalidateJournalData();
  return useMutation({ mutationFn: () => api.deleteJournal(id), onSuccess: invalidate });
}

/** 인증 신청(true) / 신청 취소(false) */
export function useVerification(id: number) {
  const invalidate = useInvalidateJournalData();
  return useMutation({
    mutationFn: (request: boolean) => (request ? api.requestVerification(id) : api.cancelVerification(id)),
    onSuccess: invalidate,
  });
}

// --- 커뮤니티 ---

export const usePosts = (category: PostCategory | null, sort: 'latest' | 'popular', filter: PostFilter = {}) =>
  useQuery({
    queryKey: ['community', 'posts', category, sort, filter.sido ?? null, filter.species ?? null],
    queryFn: () => api.posts(category, sort, filter),
  });

/** 즐겨찾기 낚시터 (로그인했을 때만) */
export const useFavorites = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: ['me', 'favorites'], queryFn: api.favorites, enabled: signedIn });
};

export function useSetFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { placeId: number; on: boolean }) => api.setFavorite(v.placeId, v.on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'favorites'] }),
  });
}

export const usePost = (id: number) =>
  useQuery({ queryKey: ['community', 'post', id], queryFn: () => api.post(id), enabled: Number.isFinite(id) });

/** 글·댓글·좋아요가 바뀌면 목록과 상세를 함께 갱신 */
function useInvalidateCommunity() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['community'] });
}

export function useCreatePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (input: PostInput) => api.createPost(input), onSuccess: invalidate });
}

export function useDeletePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: number) => api.deletePost(id), onSuccess: invalidate });
}

export function useAddComment(postId: number) {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (body: string) => api.addComment(postId, body), onSuccess: invalidate });
}

export function useDeleteComment() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: number) => api.deleteComment(id), onSuccess: invalidate });
}

export function useSetLike(postId: number) {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (liked: boolean) => api.setLike(postId, liked), onSuccess: invalidate });
}

export function useReport() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (v: { type: 'post' | 'comment'; id: number; reason: string }) => api.report(v.type, v.id, v.reason),
    onSuccess: invalidate,
  });
}

// --- 출조계획 (로그인했을 때만) ---
export const useTrips = (when: 'upcoming' | 'past') => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: ['trips', 'list', when], queryFn: () => api.trips(when), enabled: signedIn });
};

export const useTrip = (id: number) => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: ['trips', id], queryFn: () => api.trip(id), enabled: signedIn && Number.isFinite(id) });
};

export const useTripOutlook = (id: number) => {
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: ['trips', id, 'outlook'],
    queryFn: () => api.tripOutlook(id),
    enabled: signedIn && Number.isFinite(id),
    staleTime: 5 * 60_000,
  });
};

/** 계획을 바꾸는 요청 공통: 결과(Trip)로 상세 캐시를 바로 바꾸고 목록·해황은 다시 불러온다 */
export function useTripMutation<V>(fn: (v: V) => Promise<Trip>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (t) => {
      qc.setQueryData(['trips', t.id], t);
      qc.invalidateQueries({ queryKey: ['trips', 'list'] });
      qc.invalidateQueries({ queryKey: ['trips', t.id, 'outlook'] });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteTrip(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips', 'list'] }),
  });
}
