import { StyleSheet, View } from 'react-native';

import { Card, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export type LegalSection = { title: string; body: string };

/** 약관·방침 화면 공통 틀. 출시 전 법률 검토를 받아 확정본으로 바꾼다 */
export function LegalDoc({ updated, intro, sections }: { updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <StackScreen>
      <Card>
        <ThemedText type="small" themeColor="warning">
          초안 · 시행 전 검토 중 ({updated})
        </ThemedText>
        <ThemedText type="small">{intro}</ThemedText>
      </Card>
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <ThemedText type="smallBold">{s.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {s.body}
          </ThemedText>
        </View>
      ))}
    </StackScreen>
  );
}

const styles = StyleSheet.create({ section: { gap: 4 } });
