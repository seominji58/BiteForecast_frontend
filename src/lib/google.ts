/**
 * 구글 로그인 (네이티브 SDK). 개발용 앱(npx expo run:ios)·배포 앱에서만 동작한다.
 * Expo Go 에는 이 네이티브 모듈이 없어서 불러오기가 실패하면 「사용 불가」로 처리한다.
 *
 * 필요한 값 (frontend/.env, 구글 클라우드 콘솔 → 사용자 인증 정보 → OAuth 클라이언트 ID):
 * - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 「웹 애플리케이션」 유형. ID 토큰의 대상(aud)이 되며 서버 GOOGLE_CLIENT_IDS 에도 넣는다
 * - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 「iOS」 유형 (번들 ID com.seominji58.biteforecast)
 */
/* eslint-disable @typescript-eslint/no-require-imports */

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let mod: GoogleModule | null = null;
try {
  mod = require('@react-native-google-signin/google-signin') as GoogleModule;
} catch {
  mod = null;
}

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
let configured = false;

/** 이 앱 빌드에서 구글 로그인을 쓸 수 있는지 (네이티브 모듈 + 클라이언트 ID) */
export function googleAvailable(): boolean {
  return !!mod && !!WEB_ID;
}

/** 구글 계정 선택 → ID 토큰. 사용자가 취소하면 null */
export async function googleIdToken(): Promise<string | null> {
  if (!mod || !WEB_ID) throw new Error('이 앱에서는 구글 로그인을 쓸 수 없어요');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_ID, iosClientId: IOS_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.idToken) throw new Error('구글에서 로그인 정보를 받지 못했어요');
    return res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return null;
    }
    throw e;
  }
}

/** 구글 로그아웃 (다음에 계정을 다시 고를 수 있게) */
export async function googleSignOut(): Promise<void> {
  if (mod && configured) await mod.GoogleSignin.signOut().catch(() => undefined);
}

/** 처음 보는 구글 계정: 가입 화면으로 넘길 때 토큰을 주소에 싣지 않고 메모리에만 둔다 */
export const pendingGoogle: { idToken: string | null; email: string | null; name: string | null } = {
  idToken: null,
  email: null,
  name: null,
};
