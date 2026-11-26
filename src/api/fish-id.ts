/** 사진으로 어종 찾기 API (서버 /fish-id, 2026-11-26). 사진은 서버가 줄이고 위치 정보를 지운 뒤 AI에 보내며 저장하지 않는다 */
import { useQuery } from '@tanstack/react-query';

import { API_URL, ApiError, authHeaders, request } from '@/api/client';
import { useAuth } from '@/lib/auth';

export type FishCandidate = {
  code: string | null;
  name: string;
  confidence: '높음' | '보통' | '낮음';
  features: string;
};

export type FishIdResult = {
  is_fish: boolean;
  candidates: FishCandidate[];
  photo_tip: string | null;
  notice: string;
  remaining: number;
};

export const useFishIdStatus = () => {
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: ['fish-id-status'],
    queryFn: () => request<{ enabled: boolean; remaining: number }>('/fish-id/status'),
    enabled: signedIn,
    staleTime: 60_000,
  });
};

export async function identifyFish(file: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<FishIdResult> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.fileName ?? 'fish.jpg', type: file.mimeType ?? 'image/jpeg' } as unknown as Blob);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${API_URL}/fish-id`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(await authHeaders()) },
      body: form,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, data?.error?.code ?? 'FISH_ID_FAILED', data?.error?.message ?? '어종을 찾지 못했어요');
    }
    return data as FishIdResult;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }
}
