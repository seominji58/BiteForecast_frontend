import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api';
import type { JournalInput, PostCategory, PostInput } from '@/api/types';

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

export const useJournals = () => useQuery({ queryKey: queryKeys.journals, queryFn: api.journals });

export const useJournal = (id: number) =>
  useQuery({ queryKey: queryKeys.journal(id), queryFn: () => api.journal(id), enabled: Number.isFinite(id) });

export const useRegions = () => useQuery({ queryKey: ['regions'], queryFn: api.regions });

export const useDateRange = () => useQuery({ queryKey: ['meta', 'date-range'], queryFn: api.dateRange });

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
export const usePlacesSummary = (date: string | undefined) =>
  useQuery({
    queryKey: ['places-summary', date],
    queryFn: () => api.placesSummary(date!),
    enabled: !!date,
    staleTime: 5 * 60_000,
  });

export const useSources = () => useQuery({ queryKey: ['meta', 'sources'], queryFn: api.sources, staleTime: Infinity });

export const useMyTitle = () => useQuery({ queryKey: queryKeys.myTitle, queryFn: api.myTitle });

export const useMyPoints = () => useQuery({ queryKey: queryKeys.myPoints, queryFn: api.myPoints });

/** 일지가 바뀌면 일지 목록과 포인트·칭호를 함께 갱신한다 */
function useInvalidateJournalData() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.journals }),
      qc.invalidateQueries({ queryKey: queryKeys.me }),
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

export const usePosts = (category: PostCategory | null, sort: 'latest' | 'popular') =>
  useQuery({ queryKey: ['community', 'posts', category, sort], queryFn: () => api.posts(category, sort) });

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
