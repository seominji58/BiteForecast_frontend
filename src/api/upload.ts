import { useEffect, useState } from 'react';

import { API_URL, ApiError, authHeaders } from '@/api/client';
import type { Photo } from '@/api/types';
import { currentToken, loadToken, onTokenChange } from '@/lib/session';

export type PhotoPurpose = 'journal' | 'post';

const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * 사진 1장 업로드 (진행률 표시를 위해 fetch 대신 XMLHttpRequest).
 * 서버가 EXIF·위치를 지운 사본만 저장한다. takenAt: 기기가 알려준 촬영 시각(선택, 검토 참고용)
 */
export async function uploadPhoto(
  file: { uri: string; mimeType?: string | null; fileName?: string | null },
  purpose: PhotoPurpose,
  onProgress: (ratio: number) => void,
  takenAt?: string | null,
): Promise<Photo> {
  const headers = await authHeaders();
  const form = new FormData();
  // React Native FormData 는 {uri,name,type} 객체로 파일을 보낸다
  form.append('file', {
    uri: file.uri,
    name: file.fileName ?? 'photo.jpg',
    type: file.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  form.append('purpose', purpose);
  if (takenAt) form.append('taken_at', takenAt);

  return new Promise<Photo>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/photos`);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: { error?: { code?: string; message?: string } } | Photo | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        onProgress(1);
        resolve(data as Photo);
      } else {
        const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
        reject(new ApiError(xhr.status, err?.code ?? 'UPLOAD_FAILED', err?.message ?? `업로드에 실패했습니다 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.'));
    xhr.ontimeout = () => reject(new ApiError(0, 'TIMEOUT', '업로드 시간이 초과됐습니다. 다시 시도해 주세요.'));
    xhr.send(form);
  });
}

/**
 * 서버 사진을 expo-image 로 보여줄 때의 source.
 * 공개 글 사진은 로그인 없이도 보이고, 내 비공개(인증용) 사진은 로그인 토큰이 있어야 서버가 내려준다.
 */
export function usePhotoSource() {
  const [token, setTok] = useState<string | null>(currentToken());
  const [ready, setReady] = useState(currentToken() != null);
  useEffect(() => {
    let alive = true;
    loadToken().then((t) => {
      if (!alive) return;
      setTok(t);
      setReady(true);
    });
    const off = onTokenChange((t) => setTok(t));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return (photo: Photo) =>
    ready
      ? {
          uri: `${API_URL}${photo.url}`,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cacheKey: `photo-${photo.id}`,
        }
      : null;
}
