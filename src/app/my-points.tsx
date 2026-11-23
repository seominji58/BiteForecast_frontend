import { Stack } from 'expo-router';

import { useMyTitle } from '@/api/queries';
import { AuthGate } from '@/components/login-required';
import { HowToEarn, PointHistory, TitleProgress } from '@/components/me-points';
import { ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';

/** 칭호·포인트 (내정보에서 들어온다): 칭호 진행 · 포인트 쌓는 법 · 포인트 내역 */
function Body() {
  const title = useMyTitle();
  return (
    <>
      <SectionHeader title="칭호" />
      {title.isPending && <Loading />}
      {title.isError && <ErrorView message={title.error.message} onRetry={() => title.refetch()} />}
      {title.isSuccess && <TitleProgress t={title.data} />}

      <SectionHeader title="포인트 쌓는 법" />
      <HowToEarn />

      <SectionHeader title="포인트 내역" />
      <PointHistory />
    </>
  );
}

export default function MyPointsScreen() {
  return (
    <AuthGate message="칭호·포인트는 로그인 후 볼 수 있어요." icon="medal">
      <StackScreen>
        <Stack.Screen options={{ title: '칭호·포인트' }} />
        <Body />
      </StackScreen>
    </AuthGate>
  );
}
