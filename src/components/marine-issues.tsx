/**
 * 적조·해파리 (국립수산과학원, 2026-11-24): 낚시터 상세 「안전 정보」 시트 아래.
 * 최근 14일 적조 속보(특보상황·진행상황 원문 요약)와 최신 해파리 보고 제목 — 앱이 판정하지 않는다.
 */
import { StyleSheet, View } from 'react-native';

import { useMarineIssues } from '@/api/queries';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const day = (s: string) => (s.length >= 8 ? `${Number(s.slice(4, 6))}/${Number(s.slice(6, 8))}` : s);

export function MarineIssuesCard() {
  const theme = useTheme();
  const q = useMarineIssues();
  if (!q.data) return null;
  const { redtide, jelly, source } = q.data;
  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold">적조·해파리</ThemedText>
      {redtide.length ? (
        redtide.map((r) => (
          <View key={r.date + (r.seas ?? '')} style={styles.item}>
            <ThemedText type="smallBold" themeColor="warning">
              적조 속보 · {r.date.slice(5).replace('-', '/')}
              {r.seas ? ` · ${r.seas}` : ''}
            </ThemedText>
            {r.breaking || r.progress ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                {r.breaking ?? r.progress}
              </ThemedText>
            ) : null}
          </View>
        ))
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          최근 2주 동안 적조 속보가 없어요
        </ThemedText>
      )}
      {jelly[0] ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          해파리 · {jelly[0].breaking ? '속보' : '주간보고'} {day(jelly[0].date)} · {jelly[0].title}
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.src}>
        출처: {source} 적조·해파리 정보 (원문 요약)
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 6 },
  item: { gap: 2 },
  src: { fontSize: 11 },
});
