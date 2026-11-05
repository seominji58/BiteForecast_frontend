import { getDeviceId } from '@/lib/device-id';

/**
 * API 기본 주소. .env 의 EXPO_PUBLIC_API_URL 로 지정한다.
 * 실기기(Expo Go)에서는 localhost 가 휴대폰 자신을 가리키므로 개발 PC 의 LAN IP 를 넣어야 한다.
 * 예) EXPO_PUBLIC_API_URL=http://192.168.0.10:8000/api/v1
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const TIMEOUT_MS = 10_000;

/** 서버 공통 오류 형식 {"error": {"code", "message"}} 를 담는다 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** /me, /journals 계열은 true (X-Device-Id 헤더 첨부) */
  auth?: boolean;
};

export async function request<T>(path: string, { method = 'GET', body, auth = false }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) headers['X-Device-Id'] = await getDeviceId();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // 통신 장애·타임아웃 (NFR-04)
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? `요청에 실패했습니다 (${res.status})`);
  }
  return data as T;
}
