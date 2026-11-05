import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * 기기 식별 UUID (명세 D-2: 로그인 없이 기기 단위로 서버에 저장).
 * iOS Keychain / Android Keystore(SecureStore)에 보관한다. 웹 미리보기에서는 localStorage 사용.
 */
const KEY = 'biteforecast.device_id';

let cached: string | null = null;

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

async function write(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await read();
  if (!id) {
    id = Crypto.randomUUID();
    await write(id);
  }
  cached = id;
  return id;
}
