/**
 * 빌드 설정: app.json 을 바탕으로 로그인·지도 SDK 설정을 더한다 (소셜 로그인·지도 SDK 설계 2026-11-16).
 * 키는 .env 에서 읽어 빌드할 때 앱에 넣는다 (네이티브 앱 키·클라이언트 ID 는 비밀 키가 아니다).
 * - EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 카카오 로그인(돌아올 주소 kakao{키})·카카오맵
 * - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: iOS 구글 로그인이 돌아올 주소(거꾸로 쓴 클라이언트 ID)
 * 키가 없으면 그 플러그인을 넣지 않는다 (Expo Go·키 없는 개발 환경에서도 설정이 깨지지 않게)
 */
import { existsSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const KAKAO_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
const GOOGLE_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

/** 123-abc.apps.googleusercontent.com → com.googleusercontent.apps.123-abc */
const reversedClientId = (id: string) => id.split('.').reverse().join('.');

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: ExpoConfig['plugins'] = [...(config.plugins ?? [])];

  plugins.push([
    'expo-build-properties',
    {
      // iOS 최소 버전은 Expo 58 기본값(16.4 이상)을 그대로 쓴다 — 카카오맵 SDK 요구(15.1)보다 높다
      // 개발용 빌드의 네트워크 검사기를 끈다: 카카오 SDK(Alamofire) 요청을 가로채다 앱이 강제 종료됐다
      // (카카오 로그인 직후 토큰 요청에서 dispatch 큐 확인 실패, 시뮬레이터 2026-11-16). 배포 빌드에는 원래 없다
      ios: { networkInspector: false },
      android: {
        networkInspector: false,
        // 카카오 SDK 저장소 (로그인 SDK · 지도 SDK)
        extraMavenRepos: [
          'https://devrepo.kakao.com/nexus/content/groups/public/',
          'https://devrepo.kakao.com/nexus/repository/kakaomap-releases/',
        ],
        // 출시 APK(원스토어): 휴대폰 CPU 만 (에뮬레이터용 x86 빼서 용량 절반 이하로), 안 쓰는 리소스 제거
        buildArchs: ['armeabi-v7a', 'arm64-v8a'],
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        // 코드 줄이기(R8)가 WorkManager 의 Room DB 구현(리플렉션으로 생성)을 지워 출시 빌드가 켜자마자 꺼졌다 (2026-11-24)
        extraProguardRules: [
          '-keep class androidx.work.impl.WorkDatabase_Impl { *; }',
          '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
        ].join('\n'),
      },
    },
  ]);

  // 출시 APK 서명 (원스토어): 키는 저장소 밖 ~/.gradle/gradle.properties
  plugins.push('./plugins/with-release-signing');

  // 푸시 알림 (2026-11-25): 안드로이드는 FCM. google-services.json 은 깃에 올리지 않으니 있을 때만 연결
  plugins.push([
    'expo-notifications',
    { icon: './assets/images/android-icon-monochrome.png', color: '#0F2C4A', defaultChannel: 'default' },
  ]);

  if (KAKAO_KEY) {
    plugins.push([
      '@react-native-kakao/core',
      {
        nativeAppKey: KAKAO_KEY,
        android: { authCodeHandlerActivity: true },
        ios: { handleKakaoOpenUrl: true },
      },
    ]);
  }

  if (GOOGLE_IOS) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: reversedClientId(GOOGLE_IOS) }]);
  }

  return {
    ...config,
    name: config.name ?? '입질예보',
    slug: config.slug ?? 'biteforecast',
    ios: {
      ...config.ios,
      // 로그인 확인 창(「'앱'이 kauth.kakao.com 을 사용하여 로그인…」)에 내부 이름 대신 「입질예보」가 보이게
      infoPlist: { ...config.ios?.infoPlist, CFBundleName: '입질예보' },
    },
    android: {
      ...config.android,
      ...(existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins,
  };
};
