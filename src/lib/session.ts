import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * 로그인 토큰 보관 (iOS Keychain / Android Keystore). 비밀번호는 기기에 저장하지 않는다.
 * API 클라이언트가 동기적으로 읽을 수 있게 메모리에도 들고 있고, 바뀌면 구독자에게 알린다.
 */
const KEY = 'biteforecast.session_token';

let token: string | null = null;
let loaded = false;
const listeners = new Set<(t: string | null) => void>();

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

async function write(value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value) globalThis.localStorage?.setItem(KEY, value);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(KEY, value);
  else await SecureStore.deleteItemAsync(KEY);
}

export async function loadToken(): Promise<string | null> {
  if (!loaded) {
    token = await read().catch(() => null);
    loaded = true;
  }
  return token;
}

export function currentToken(): string | null {
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  loaded = true;
  listeners.forEach((l) => l(next));
  await write(next).catch(() => undefined);
}

export function onTokenChange(l: (t: string | null) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
