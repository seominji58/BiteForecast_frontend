# BiteForecast_frontend

입질예보 모바일 앱: React Native + Expo (SDK 58), TypeScript, Expo Router.
iOS와 Android를 하나의 코드로 만든다.

- 기능명세서: [BiteForecast_docs / 02_명세](https://github.com/seominji58/BiteForecast_docs/tree/main/02_명세)
- API 서버: [BiteForecast_backend](https://github.com/seominji58/BiteForecast_backend)

## 실행

> 매일 켜는 순서, 시뮬레이터·휴대폰 연결, 터널 주소 바꾸기, 자주 나는 문제는 **[실행 가이드](https://github.com/seominji58/BiteForecast_docs/blob/main/06_개발환경/실행_가이드.md)** 참고

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL: 시뮬레이터면 http://localhost:8000/api/v1
npx expo start         # 휴대폰이 다른 네트워크면 --tunnel. 창에서 i = iPhone 시뮬레이터
```

- **iPhone / 갤럭시**: 스토어에서 **Expo Go**를 설치하고 터미널에 뜬 QR 코드를 스캔한다.
- `.env` 를 바꾸면 `npx expo start --clear` 로 다시 켠다.

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
    (tabs)/        하단 탭: 홈 · 비교 · 기록 · 커뮤니티 · 내정보
    explore.tsx    낚시터 찾기 (지도·내 주변·조건으로 찾기)
  api/             API 클라이언트(client.ts), 응답 타입(types.ts), 엔드포인트(index.ts),
                   TanStack Query 조회 훅(queries.ts)
  lib/             기기 ID 등 유틸
  hooks/           테마
  components/      공통 UI (Screen, Card, ErrorView …)
  constants/       색상·간격
```

## 규칙

- 패키지는 `npx expo install <pkg>` 로 추가한다 (SDK 호환 버전 자동 선택)
- 위치는 「내 주변 찾기」를 누를 때만 앱 사용 중 권한으로 쓰고, 좌표는 기기 안 거리 계산에만 쓴다 (서버 전송 없음). 백그라운드 위치는 차단 (2026-11-05 결정)
- `EXPO_PUBLIC_*` 값은 앱 번들에 포함된다. 비밀값은 넣지 않는다
- `ios/`, `android/` 폴더는 직접 만들지 않는다 (빌드 시 자동 생성)

## 빌드·배포 (명세 13장)

```bash
npx eas-cli@latest build -p ios       # App Store (Apple Developer 계정 필요)
npx eas-cli@latest build -p android   # 원스토어 / Google Play
```

- Bundle ID / Package: `com.seominji58.biteforecast` (Android package는 출시 후 변경 불가)
