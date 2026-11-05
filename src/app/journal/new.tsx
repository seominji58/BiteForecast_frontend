import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useSaveJournal } from '@/api/queries';
import { JournalForm } from '@/components/journal-form';
import { StackScreen } from '@/components/screen';
import { pointResultMessage } from '@/lib/format';

// SCR-04 낚시일지 작성
export default function NewJournalScreen() {
  const save = useSaveJournal();

  return (
    <StackScreen>
      <JournalForm
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
