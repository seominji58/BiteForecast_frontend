import { router, Stack } from 'expo-router';

import { useJournals, useMyTitle } from '@/api/queries';
import { AuthGate } from '@/components/login-required';
import { PointHistory, TitleProgress, VerificationSummary } from '@/components/me-points';
import { ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';

/** 칭호·포인트 (내정보에서 들어온다): 칭호 진행 · 사진 인증 현황 · 포인트 내역 */
function Body() {
  const title = useMyTitle();
  const journals = useJournals();
  return (
    <>
      <SectionHeader title="칭호" />
      {title.isPending && <Loading />}
      {title.isError && <ErrorView message={title.error.message} onRetry={() => title.refetch()} />}
      {title.isSuccess && <TitleProgress t={title.data} />}

      <SectionHeader title="사진 인증 현황" actionLabel="기록 보기" onAction={() => router.push('/records')} />
      {journals.isSuccess ? <VerificationSummary journals={journals.data} /> : null}

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
