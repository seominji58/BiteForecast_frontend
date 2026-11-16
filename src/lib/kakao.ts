/**
 * 카카오 로그인 (네이티브 SDK + OpenID Connect). 개발용 앱·배포 앱에서만 동작한다.
 * Expo Go 에는 이 네이티브 모듈이 없어서 불러오기가 실패하면 「사용 불가」로 처리한다.
 *
 * 흐름: 서버에서 일회성 값(nonce) 받기 → 카카오 로그인(nonce 포함) → 카카오가 준 ID 토큰과 nonce 를 서버로
 * (서버가 카카오 공개키·우리 앱 키·nonce 를 확인한다. 소셜 로그인·지도 SDK 설계 §3-3)
 *
 * 필요한 값 (frontend/.env): EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY — 카카오 콘솔 네이티브 앱 키 (비밀 키 아님)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

type KakaoCore = typeof import('@react-native-kakao/core');
type KakaoUser = typeof import('@react-native-kakao/user');

let core: KakaoCore | null = null;
let user: KakaoUser | null = null;
try {
  core = require('@react-native-kakao/core') as KakaoCore;
  user = require('@react-native-kakao/user') as KakaoUser;
} catch {
  core = user = null;
}

const APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
let initialized: Promise<void> | null = null;

/** 이 앱 빌드에서 카카오 로그인을 쓸 수 있는지 (네이티브 모듈 + 앱 키) */
export function kakaoAvailable(): boolean {
  return !!core && !!user && !!APP_KEY;
}

function init(): Promise<void> {
  if (!core || !APP_KEY) return Promise.reject(new Error('이 앱에서는 카카오 로그인을 쓸 수 없어요'));
  initialized ??= core.initializeKakaoSDK(APP_KEY).catch((e) => {
    initialized = null; // 다음에 다시 시도
    throw e;
  });
  return initialized;
}

const isCancel = (e: unknown) => /cancel/i.test(String((e as Error)?.message ?? e));

/** 카카오 로그인 → OIDC ID 토큰. 사용자가 취소하면 null */
export async function kakaoIdToken(nonce: string): Promise<string | null> {
  if (!user) throw new Error('이 앱에서는 카카오 로그인을 쓸 수 없어요');
  await init();
  try {
    const res = await user.login({ nonce });
    if (!res.idToken) {
      // 카카오 콘솔에서 OpenID Connect 가 꺼져 있으면 ID 토큰이 오지 않는다
      throw new Error('카카오에서 로그인 정보(ID 토큰)를 받지 못했어요. 잠시 후 다시 시도해 주세요');
    }
    return res.idToken;
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

/** 카카오 로그아웃 (다음에 계정을 다시 고를 수 있게). 실패해도 앱 로그아웃은 진행한다 */
export async function kakaoSignOut(): Promise<void> {
  if (!user || !initialized) return;
  await user.logout().catch(() => undefined);
}

/** 탈퇴할 때 카카오 연결 끊기 (앱에서 SDK 로 — 서버에 카카오 Admin 키를 두지 않는다) */
export async function kakaoUnlink(): Promise<void> {
  if (!user || !APP_KEY) return;
  await init().catch(() => undefined);
  await user.unlink().catch(() => undefined);
}

/** 처음 보는 카카오 계정: 가입 화면으로 넘길 때 토큰·nonce 를 주소에 싣지 않고 메모리에만 둔다 (nonce 는 5분) */
export const pendingKakao: { idToken: string | null; nonce: string | null; name: string | null } = {
  idToken: null,
  nonce: null,
  name: null,
};
