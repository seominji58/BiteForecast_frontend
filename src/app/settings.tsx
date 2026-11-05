import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { API_URL } from '@/api';
import { useSources } from '@/api/queries';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { KIND_TEXT } from '@/lib/compare';

// SCR-07 설정·법적 안내 (FR-15)
// TODO: 이용약관·개인정보 처리방침 링크, 문의처, 내 데이터 삭제 (배포 전 필수)
export default function SettingsScreen() {
  const sources = useSources();

  return (
    <StackScreen>
      <Card>
        <ThemedText type="sectionTitle">데이터 출처</ThemedText>
        {sources.isPending && <Loading />}
        {sources.isError && <ErrorView message={sources.error.message} onRetry={() => sources.refetch()} />}
        {sources.data?.map((s) => (
          <View key={s.dataset} style={styles.row}>
            <ThemedText type="small" themeColor={s.connected ? 'success' : 'textSecondary'} style={styles.status}>
              {s.connected ? '연결' : '준비'}
            </ThemedText>
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {s.agency} · {s.dataset}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {KIND_TEXT[s.kind]} · {s.connected ? '연결됨' : '준비 중'}
                {s.note ? ` · ${s.note}` : ''}
              </ThemedText>
            </View>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          공공데이터포털(data.go.kr)을 통해 제공받은 공공데이터를 이용합니다.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="sectionTitle">이용 안내</ThemedText>
        <ThemedText themeColor="textSecondary">
          • 관측소 값은 낚시 장소의 현장 조건과 다를 수 있으며, 관측소까지의 거리를 함께 표시합니다.{'\n'}• 바다낚시지수는
          국립해양조사원 발표값을 그대로 보여주며 앱이 판정한 값이 아닙니다.{'\n'}• 실제 입질·조과를 보장하지 않습니다.
          출조 전 공식 특보와 현장 출입 제한을 확인하세요.{'\n'}• 목록의 장소를 낚시 허용구역으로 보증하지 않습니다.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText type="sectionTitle">앱 정보</ThemedText>
        <ThemedText themeColor="textSecondary">버전 {Constants.expoConfig?.version ?? '-'}</ThemedText>
        {__DEV__ && (
          <ThemedText type="code" themeColor="textSecondary">
            {API_URL}
          </ThemedText>
        )}
      </Card>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  status: { fontWeight: '700', width: 30 },
});
