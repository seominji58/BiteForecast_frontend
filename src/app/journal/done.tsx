/**
 * 기록 저장 축하 (2026-11-24): iOS 알림 창 대신 앱 안 화면.
 * 첫 포획·최대어 갱신 · 받은 포인트 · 칭호 진행 → [커뮤니티에 조황 공유](+5P) · [기록 보기] · [닫기]
 * 저장 직후 바로 글쓰기로 보내지 않고, 축하를 먼저 보여준 뒤 공유를 권한다 (조황 글을 늘리기 위해).
 */
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Text } from '@/components/app-text';
import { Button } from '@/components/form';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { takeLastSave } from '@/lib/last-save';
import { speciesForRecord } from '@/lib/species';

export default function JournalDoneScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const res = useMemo(() => takeLastSave(), []);
  const j = res?.journal ?? null;
  if (!res || !j) {
    // 앱을 새로 열어 결과가 없으면 기록 목록으로
    return (
      <ThemedView style={[styles.flex, styles.center]}>
        <Stack.Screen options={{ title: '기록 저장' }} />
        <Button label="내 기록 보기" onPress={() => router.replace('/records')} />
      </ThemedView>
    );
  }
  const m = res.milestone;
  const sp = speciesForRecord(j.species_code, j.species_etc);
  const skunk = j.count === 0;
  const icon = m?.kind === 'personal_best' ? 'best' : m?.kind === 'first_catch' ? 'celebrate' : 'cat-catch';
  const headline =
    m?.kind === 'first_catch'
      ? `${m.species_name} 첫 포획!`
      : m?.kind === 'personal_best'
        ? `${m.species_name} 최대어 갱신!`
        : skunk
          ? '못 잡은 날도 기록했어요'
          : '기록을 남겼어요';
  const sub =
    m?.kind === 'personal_best'
      ? `${m.previous_cm}cm → ${m.length_cm}cm`
      : m?.kind === 'first_catch'
        ? `내 도감에 추가됐어요${m.length_cm != null ? ` · ${m.length_cm}cm` : ''}`
        : [j.place_name, j.species_name, j.count ? `${j.count}마리` : null, j.max_length_cm ? `${j.max_length_cm}cm` : null]
            .filter(Boolean)
            .join(' · ');
  const t = res.title;
  const pct = t.next
    ? Math.max(0, Math.min(100, ((t.total_points - t.current.min_points) / (t.next.min_points - t.current.min_points)) * 100))
    : 100;

  const share = () => router.replace({ pathname: '/community/new', params: { journal: String(j.id) } });
  const view = () => router.replace({ pathname: '/journal/[id]', params: { id: String(j.id) } });

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: '', headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        {/* 축하 */}
        <View style={styles.hero}>
          <View style={[styles.burst, { backgroundColor: theme.tintSoft }]}>
            {sp && !m ? <SpeciesImage code={sp.code} size={96} /> : <AppIcon name={icon} size={88} />}
          </View>
          <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>
          {sub ? (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {sub}
            </ThemedText>
          ) : null}
        </View>

        {/* 포인트 · 칭호 진행 */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.row}>
            <AppIcon name="medal" size={26} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {res.title_changed ? `칭호가 「${t.current.name}」(으)로 올랐어요!` : `지금 칭호 「${t.current.name}」`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.next ? `「${t.next.name}」까지 ${t.points_to_next}P` : '최고 칭호예요'} · 총 {res.total_points}P
              </ThemedText>
            </View>
            {res.point_delta > 0 ? <Text style={styles.points}>+{res.point_delta}P</Text> : null}
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.bar, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* 공유 권하기 */}
        <View style={[styles.card, styles.shareCard, { borderColor: Brand.orange }]}>
          <ThemedText type="smallBold">{skunk ? '오늘 상황을 나눠 주세요' : '이 조황을 공유해 볼까요?'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {skunk
              ? '안 나온 날 정보도 다른 낚시인에게 큰 도움이 돼요.'
              : '어디서 · 무엇이 · 얼마나 나왔는지가 다른 낚시인에게 가장 반가운 정보예요.'}{' '}
            글을 올리면 +5P (하루 3개까지). 위치는 낚시터·지역만·숨김 중에서 고를 수 있어요.
          </ThemedText>
          <Button label="커뮤니티에 조황 공유" onPress={share} />
        </View>

        <Button label="기록 보기" variant="secondary" onPress={view} />
        <Button label="닫기" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  content: { paddingHorizontal: 20, gap: 14 },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  burst: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 26, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  shareCard: { borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  points: { color: Brand.orange, fontSize: 22, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: Brand.orange },
});
