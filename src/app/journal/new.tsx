import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { usePlaces, useSaveJournal } from '@/api/queries';
import { JournalForm } from '@/components/journal-form';
import { AuthGate } from '@/components/login-required';
import { Loading, StackScreen } from '@/components/screen';
import { pointResultMessage } from '@/lib/format';
import { useHomePlace } from '@/lib/prefs';

/** 계획 날짜 아침 6시 (출조 시각은 폼에서 고친다) */
function tripMorning(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 6, 0, 0);
}

// SCR-04 낚시일지 작성
function NewJournalScreenInner() {
  // 출조계획 「기록 남기기」: ?place=147&date=2026-11-14&trip_stop=12
  const params = useLocalSearchParams<{ place?: string; date?: string; trip_stop?: string }>();
  const save = useSaveJournal();
  const [homeId, , loaded] = useHomePlace();
  const places = usePlaces();

  // 기준 낚시터를 읽은 뒤에 폼을 그려야 장소가 미리 채워진다
  // (비활성화된 예전 장소면 미리 채우지 않는다)
  if (!loaded || places.isPending) {
    return (
      <StackScreen>
        <Loading />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <JournalForm
        defaultPlaceId={
          params.place && places.data?.some((p) => p.id === Number(params.place))
            ? Number(params.place)
            : places.data?.some((p) => p.id === homeId)
              ? homeId
              : null
        }
        defaultFishedAt={params.date ? tripMorning(params.date) : undefined}
        submitLabel="저장"
        submitting={save.isPending}
        serverError={save.error?.message}
        onSubmit={(input) =>
          save.mutate(
            // 계획의 낚시터 그대로 저장할 때만 계획에 연결 (장소를 바꾸면 연결하지 않는다)
            params.trip_stop && String(input.place_id) === params.place
              ? { ...input, trip_stop_id: Number(params.trip_stop) }
              : input,
            {
            onSuccess: (res) => {
              Alert.alert('저장했습니다', pointResultMessage(res));
              // 저장한 기록 상세로 (인증 상태·공유를 바로 볼 수 있게)
              if (res.journal) router.replace({ pathname: '/journal/[id]', params: { id: String(res.journal.id) } });
              else router.back();
            },
            },
          )
        }
      />
    </StackScreen>
  );
}

export default function NewJournalScreen() {
  return (
    <AuthGate message="낚시 기록은 로그인 후 남길 수 있어요." icon="write">
      <NewJournalScreenInner />
    </AuthGate>
  );
}
