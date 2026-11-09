import { getDeviceId } from '@/lib/device-id';
import { currentToken, loadToken, setToken } from '@/lib/session';

/**
 * API 기본 주소. .env 의 EXPO_PUBLIC_API_URL 로 지정한다.
 * 실기기(Expo Go)에서는 localhost 가 휴대폰 자신을 가리키므로 개발 PC 의 LAN IP 를 넣어야 한다.
 * 예) EXPO_PUBLIC_API_URL=http://192.168.0.10:8001/api/v1
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001/api/v1';

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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** @deprecated 로그인 토큰은 항상 붙는다 (있을 때). 호환용으로만 남김 */
  auth?: boolean;
};

/** 공통 헤더: 로그인 토큰(있으면) + 기기 ID(로그인 없이 쓰던 기록을 계정으로 옮길 때 사용) */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-Device-Id': await getDeviceId() };
  const token = currentToken() ?? (await loadToken());
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(await authHeaders()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

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
    // 로그인이 만료됐거나 다른 기기에서 탈퇴한 경우: 토큰을 지우고 로그인 화면으로 유도
    if (res.status === 401 && headers.Authorization) await setToken(null);
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? `요청에 실패했습니다 (${res.status})`);
  }
  return data as T;
}
