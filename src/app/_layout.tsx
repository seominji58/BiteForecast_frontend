import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { ApiError } from '@/api';
import { Brand } from '@/constants/theme';
import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
          screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            headerStyle: { backgroundColor: Brand.navy },
            headerTintColor: Brand.onNavy,
            headerTitleStyle: { fontWeight: '700' },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="journal/new" options={{ title: '낚시일지 작성' }} />
          <Stack.Screen name="journal/[id]" options={{ title: '낚시일지' }} />
          <Stack.Screen name="settings" options={{ title: '설정·정보' }} />
          <Stack.Screen name="place/[id]" options={{ title: '상세 해황' }} />
          <Stack.Screen name="explore" options={{ title: '낚시터 찾기' }} />
          <Stack.Screen name="compare" options={{ title: '조건 비교' }} />
          <Stack.Screen name="trip/new" options={{ title: '새 출조계획' }} />
          <Stack.Screen name="trip/[id]" options={{ title: '출조계획' }} />
          <Stack.Screen name="login" options={{ title: '로그인' }} />
          <Stack.Screen name="signup" options={{ title: '회원가입' }} />
          <Stack.Screen name="terms" options={{ title: '이용약관' }} />
          <Stack.Screen name="privacy" options={{ title: '개인정보 처리방침' }} />
          <Stack.Screen name="info/safety" options={{ title: '금어기·출조 안전 정보' }} />
          <Stack.Screen name="community/new" options={{ title: '글쓰기' }} />
          <Stack.Screen name="community/[id]" options={{ title: '커뮤니티' }} />
        </Stack>
      </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
