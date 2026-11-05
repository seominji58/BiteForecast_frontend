import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { ApiError } from '@/api';

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
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="journal/new" options={{ title: '낚시일지 작성' }} />
          <Stack.Screen name="journal/[id]" options={{ title: '낚시일지' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
