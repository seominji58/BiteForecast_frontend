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

/**
 * 사진 1장으로 어종 후보 받기. 기록 사진 업로드(api/upload.ts)와 같이 XMLHttpRequest 로 보낸다
 * — fetch + FormData({uri}) 는 이 앱 환경에서 서버에 닿기 전에 「Network request failed」로 끊겼다 (2026-11-26 에뮬레이터)
 */
export async function identifyFish(file: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<FishIdResult> {
  const headers = await authHeaders();
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.fileName ?? 'fish.jpg', type: file.mimeType ?? 'image/jpeg' } as unknown as Blob);
  return new Promise<FishIdResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/fish-id`);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 60_000;
    xhr.onload = () => {
      let data: (FishIdResult & { error?: { code?: string; message?: string } }) | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else
        reject(
          new ApiError(xhr.status, data?.error?.code ?? 'FISH_ID_FAILED', data?.error?.message ?? `어종을 찾지 못했어요 (${xhr.status})`),
        );
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없어요. 네트워크를 확인해 주세요.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'TIMEOUT', '응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.'));
    xhr.send(form);
  });
}
