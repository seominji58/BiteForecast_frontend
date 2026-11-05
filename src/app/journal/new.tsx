import { router } from 'expo-router';
import { Alert } from 'react-native';

import { usePlaces, useSaveJournal } from '@/api/queries';
import { JournalForm } from '@/components/journal-form';
import { Loading, StackScreen } from '@/components/screen';
import { pointResultMessage } from '@/lib/format';
import { useHomePlace } from '@/lib/prefs';

// SCR-04 낚시일지 작성
export default function NewJournalScreen() {
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
        defaultPlaceId={places.data?.some((p) => p.id === homeId) ? homeId : null}
        submitLabel="저장"
        submitting={save.isPending}
        serverError={save.error?.message}
        onSubmit={(input) =>
          save.mutate(input, {
            onSuccess: (res) => {
              Alert.alert('저장했습니다', pointResultMessage(res));
              router.back();
            },
          })
        }
      />
    </StackScreen>
  );
}
