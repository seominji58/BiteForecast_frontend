/** 용어 풀이 창 (아래에서 올라옴) */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { type TermKey, TERMS } from '@/lib/glossary';

export function TermSheet({ term, onClose }: { term: TermKey | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = term ? TERMS[term] : null;
  return (
    <Modal visible={!!t} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
        {t ? (
          <ScrollView contentContainerStyle={styles.body}>
            <ThemedText type="subtitle">{t.title}</ThemedText>
            <ThemedText>{t.summary}</ThemedText>
            <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {t.points.map((p) => (
                <ThemedText key={p} type="small">
                  • {p}
                </ThemedText>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.close, { backgroundColor: theme.tint }]}>
              <ThemedText type="smallBold" themeColor="onTint">
                확인
              </ThemedText>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,20,40,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 18, maxHeight: '75%' },
  body: { gap: 10 },
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 4 },
  link: { fontWeight: '700' },
  close: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

/** 카드 아래 「○○ 뜻 보기」 링크 줄 (누르면 용어 풀이 창) */
export function TermLinks({ items }: { items: [TermKey, string][] }) {
  const [term, setTerm] = useState<TermKey | null>(null);
  return (
    <View style={styles.links}>
      {items.map(([k, label]) => (
        <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${label} 뜻 보기`} onPress={() => setTerm(k)} hitSlop={6}>
          <ThemedText type="small" themeColor="tint" style={styles.link}>
            ⓘ {label}
          </ThemedText>
        </Pressable>
      ))}
      <TermSheet term={term} onClose={() => setTerm(null)} />
    </View>
  );
}
