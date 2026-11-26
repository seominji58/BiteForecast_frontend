import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, useColorScheme } from 'react-native';

import { Text } from '@/components/app-text';
import { ApiError } from '@/api';
import { Brand } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';
import { listenPushTaps } from '@/lib/push';
import { PermissionNotice } from '@/components/permission-notice';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // 앱이 다시 앞으로 오면 오래된 자료(오늘 날짜·예보·특보)를 다시 불러온다.
  // 자정을 넘겨 다시 열었는데 어제를 「오늘」로 보여주던 문제 (iOS 시뮬레이터 검증 2026-11-10)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (st) => focusManager.setFocused(st === 'active'));
    return () => sub.remove();
  }, []);
  // 알림을 누르면 그 낚시터·출조계획 화면으로
  useEffect(() => listenPushTaps(), []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 4xx 는 재시도해도 같은 결과이므로 네트워크 오류·5xx 만 1회 재시도 (NFR-04)
            retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
            staleTime: 60_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={({ navigation }) => ({
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: Brand.navy },
              headerTintColor: Brand.onNavy,
              headerTitleStyle: { fontWeight: '700' },
              // 링크·알림으로 바로 열려 돌아갈 화면이 없으면 기본 ‹ 가 사라진다 → 홈으로 가는 버튼 (2026-11-23)
              headerLeft: navigation.canGoBack() ? undefined : () => <HomeBack />,
            })}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="journal/new" options={{ title: '낚시일지 작성' }} />
            <Stack.Screen name="journal/done" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="journal/[id]" options={{ title: '낚시일지' }} />
            <Stack.Screen name="settings" options={{ title: '설정·정보' }} />
            <Stack.Screen name="place/[id]" options={{ title: '상세 해황' }} />
            <Stack.Screen name="explore" options={{ title: '낚시터 찾기' }} />
            <Stack.Screen name="compare" options={{ title: '조건 비교' }} />
            <Stack.Screen name="species" options={{ title: '전체 어종' }} />
            <Stack.Screen name="rules" options={{ title: '금어기·금지체장' }} />
            <Stack.Screen name="my-records" options={{ title: '내 낚시 요약' }} />
            <Stack.Screen name="my-places" options={{ title: '내 낚시터' }} />
            <Stack.Screen name="challenge" options={{ title: '전국 낚시 탐험' }} />
            <Stack.Screen name="ask" options={{ title: '입질예보에게 묻기' }} />
            <Stack.Screen name="spot/new" options={{ title: '내 포인트 추가' }} />
            <Stack.Screen name="my-points" options={{ title: '칭호·포인트' }} />
            <Stack.Screen name="profile-edit" options={{ title: '닉네임 변경' }} />
            <Stack.Screen name="trip/new" options={{ title: '새 출조계획' }} />
            <Stack.Screen name="trip/[id]" options={{ title: '출조계획' }} />
            <Stack.Screen name="trip/join" options={{ title: '초대 코드로 참여' }} />
            <Stack.Screen name="login" options={{ title: '로그인' }} />
            <Stack.Screen name="login-email" options={{ title: '이메일 로그인' }} />
            <Stack.Screen name="signup" options={{ title: '회원가입' }} />
            <Stack.Screen name="terms" options={{ title: '이용약관' }} />
            <Stack.Screen name="privacy" options={{ title: '개인정보 처리방침' }} />
            <Stack.Screen name="info/safety" options={{ title: '금어기·출조 안전 정보' }} />
            <Stack.Screen name="community/new" options={{ title: '글쓰기' }} />
            <Stack.Screen name="community/[id]" options={{ title: '커뮤니티' }} />
            <Stack.Screen name="community/edit" options={{ title: '글 고치기' }} />
          </Stack>
          <PermissionNotice />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** 돌아갈 화면이 없을 때 왼쪽 위: 홈으로 */
function HomeBack() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="홈으로"
      hitSlop={10}
      onPress={() => router.replace('/')}
      style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
      <Text style={{ color: Brand.onNavy, fontSize: 15, fontWeight: '700' }}>‹ 홈</Text>
    </Pressable>
  );
}
