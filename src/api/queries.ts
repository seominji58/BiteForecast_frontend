import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import type { JournalInput, PostCategory, PostEdit, PostFilter, PostInput, Trip } from '@/api/types';
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

/** 공공데이터 이름에 「(폐업)」이 붙은 낚시터는 앱 어디에도 보이지 않게 뺀다 (2026-11-18) */
const isClosed = (name: string) => /\((폐업|휴업|폐쇄)\)/.test(name);

export const usePlaces = (q?: string, regionId?: number) =>
  useQuery({
    queryKey: queryKeys.places(q, regionId),
    queryFn: () => api.places({ q, regionId }),
    select: (list) => list.filter((p) => !isClosed(p.name)),
  });

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

const postKey = (category: PostCategory | null, sort: string, filter: PostFilter) =>
  ['community', 'posts', category, sort, filter.sido ?? null, filter.species ?? null, filter.placeId ?? null] as const;

/** 글 목록 한 번 (홈·상세 등 미리보기용, limit 건) */
export const usePosts = (
  category: PostCategory | null,
  sort: 'latest' | 'popular',
  filter: PostFilter = {},
  limit?: number,
) =>
  useQuery({
    queryKey: [...postKey(category, sort, filter), limit ?? null],
    queryFn: () => api.posts(category, sort, filter, { limit }),
  });

export const POST_PAGE = 20;

/** 커뮤니티 탭 목록: 최신순은 「더 보기」로 이어서 받는다 (인기순은 30일 안 상위 한 번) */
export const usePostPages = (category: PostCategory | null, sort: 'latest' | 'popular', filter: PostFilter = {}) =>
  useInfiniteQuery({
    queryKey: [...postKey(category, sort, filter), 'pages'],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api.posts(category, sort, filter, { limit: sort === 'latest' ? POST_PAGE : 50, beforeId: pageParam }),
    getNextPageParam: (last) =>
      sort === 'latest' && last.length === POST_PAGE ? last[last.length - 1].id : undefined,
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

export function useUpdatePost(id: number) {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (input: PostEdit) => api.updatePost(id, input), onSuccess: invalidate });
}

/** 낚시터별 최근 이용자 조황 (지도 핀·어종 칩·낚시터 카드). 글이 바뀌면 커뮤니티와 함께 갱신 */
/** 지역·장소 검색 (2글자 이상, 같은 검색어는 10분 캐시) */
export const useGeoSearch = (q: string) =>
  useQuery({ queryKey: ['geo', q], queryFn: () => api.geoSearch(q), enabled: q.trim().length >= 2, staleTime: 10 * 60_000 });

/** 낚시터 실제 사진 목록용 썸네일 (사진 있는 곳만, 하루 동안 다시 받지 않음) */
export const usePlacePhotoIndex = () =>
  useQuery({ queryKey: ['place-photos'], queryFn: api.placePhotoIndex, staleTime: 24 * 3600_000, retry: false });

/** 낚시터 실제 사진 (상세). 사진이 없으면 404 → 재시도하지 않는다 */
/** 카카오 장소 링크·도로명 주소 (매칭 안 된 곳은 404 → 표시 안 함) */
export const usePlaceKakao = (placeId: number) =>
  useQuery({ queryKey: ['place-kakao', placeId], queryFn: () => api.placeKakao(placeId), staleTime: 24 * 3600_000, retry: false });

export const usePlacePhotos = (placeId: number | null, enabled = true) =>
  useQuery({
    queryKey: ['place-photos', placeId],
    queryFn: () => api.placePhotos(placeId!),
    enabled: enabled && placeId != null,
    staleTime: 24 * 3600_000,
    retry: false,
  });

/** 낚시터 근처 낚시점·낚시배 (서버가 1시간 캐시, 앱도 30분 보관) */
export const useNearbyShops = (placeId: number | null) =>
  useQuery({
    queryKey: ['nearby-shops', placeId],
    queryFn: () => api.nearbyShops(placeId!),
    enabled: placeId != null && Number.isFinite(placeId),
    staleTime: 30 * 60_000,
  });

export const useCatchSummary = (days = 14) =>
  useQuery({ queryKey: ['community', 'catch-summary', days], queryFn: () => api.catchSummary(days), staleTime: 5 * 60_000 });

export function useDeletePost() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: number) => api.deletePost(id), onSuccess: invalidate });
}

export function useAddComment(postId: number) {
  const invalidate = useInvalidateCommunity();
  // 문자열이면 원댓글, { body, parentId } 면 그 댓글에 다는 답글
  return useMutation({
    mutationFn: (v: string | { body: string; parentId?: number | null }) =>
      typeof v === 'string' ? api.addComment(postId, v) : api.addComment(postId, v.body, v.parentId),
    onSuccess: invalidate,
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (id: number) => api.deleteComment(id), onSuccess: invalidate });
}

export function useSetLike(postId: number) {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (liked: boolean) => api.setLike(postId, liked), onSuccess: invalidate });
}

/** 내 낚시 기록 요약 (기록이 바뀌면 함께 갱신되도록 journals 키 아래) */
export const useRecordSummary = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: ['journals', 'summary'], queryFn: api.recordSummary, enabled: signedIn });
};

export const useBlocks = () => {
  const { signedIn } = useAuth();
  return useQuery({ queryKey: ['community', 'blocks'], queryFn: api.blocks, enabled: signedIn });
};

export function useBlock() {
  const invalidate = useInvalidateCommunity();
  return useMutation({
    mutationFn: (v: { type: 'post' | 'comment'; id: number }) => api.block(v.type, v.id),
    onSuccess: invalidate,
  });
}

export function useUnblock() {
  const invalidate = useInvalidateCommunity();
  return useMutation({ mutationFn: (userId: number) => api.unblock(userId), onSuccess: invalidate });
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
