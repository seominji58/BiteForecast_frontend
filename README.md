# BiteForecast_frontend

입질예보 모바일 앱: React Native + Expo (SDK 58), TypeScript, Expo Router.
iOS와 Android를 하나의 코드로 만든다.

- 기능명세서: [BiteForecast_docs / 02_명세](https://github.com/seominji58/BiteForecast_docs/tree/main/02_명세)
- API 서버: [BiteForecast_backend](https://github.com/seominji58/BiteForecast_backend)

## 실행

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL 을 개발 PC 의 LAN IP 로 수정
npx expo start
```

- **iPhone / 갤럭시**: 스토어에서 **Expo Go**를 설치하고 터미널에 뜬 QR 코드를 스캔한다. 휴대폰과 PC가 같은 Wi-Fi에 있어야 한다.
- 백엔드는 `--host 0.0.0.0` 으로 실행해야 휴대폰에서 접속할 수 있다 (backend README 참고).

## 점검

```bash
npx tsc --noEmit    # 타입 체크
npx expo lint       # 린트
npx expo-doctor     # 의존성 점검
```

## 구조

```
src/
  app/             화면(라우트). 파일 하나가 화면 하나
    _layout.tsx    루트 Stack
    (tabs)/        하단 탭: 홈 · 내 기록 · 칭호 · 설정
  api/             API 클라이언트(client.ts), 응답 타입(types.ts), 엔드포인트(index.ts),
                   TanStack Query 조회 훅(queries.ts)
  lib/             기기 ID 등 유틸
  hooks/           테마
  components/      공통 UI (Screen, Card, ErrorView …)
  constants/       색상·간격
```

## 규칙

- 패키지는 `npx expo install <pkg>` 로 추가한다 (SDK 호환 버전 자동 선택)
- 위치 권한은 쓰지 않는다. Android 위치 권한은 `app.json`의 `blockedPermissions`로 차단해 두었다 (NFR-01, TC-07)
- `EXPO_PUBLIC_*` 값은 앱 번들에 포함된다. 비밀값은 넣지 않는다
- `ios/`, `android/` 폴더는 직접 만들지 않는다 (빌드 시 자동 생성)

## 빌드·배포 (명세 13장)

```bash
npx eas-cli@latest build -p ios       # App Store (Apple Developer 계정 필요)
npx eas-cli@latest build -p android   # 원스토어 / Google Play
```

- Bundle ID / Package: `com.seominji58.biteforecast` (Android package는 출시 후 변경 불가)
