import { API_URL } from '@/api';
import { Card, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

// SCR-07 설정·법적 안내 (FR-15) — TODO: 이용약관/개인정보 처리방침 링크, 문의, 내 데이터 삭제
export default function SettingsScreen() {
  return (
    <Screen title="설정">
      <Card>
        <ThemedText type="smallBold">데이터 출처</ThemedText>
        <ThemedText themeColor="textSecondary">국립해양조사원, 기상청 (연동 예정)</ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">안내</ThemedText>
        <ThemedText themeColor="textSecondary">
          이 앱은 실제 입질·조과를 보장하지 않습니다. 출조 전 공식 특보와 현장 출입 제한을 확인하세요.
        </ThemedText>
      </Card>

      {__DEV__ && (
        <Card>
          <ThemedText type="smallBold">개발 정보</ThemedText>
          <ThemedText type="code">{API_URL}</ThemedText>
        </Card>
      )}
    </Screen>
  );
}
