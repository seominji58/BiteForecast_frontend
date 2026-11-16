/**
 * 내 낚시 요약 (서비스 개선 설계 R1): 출조 일수 · 잡은 어종(도감) · 어종별 첫 포획·최대어.
 * - 기존 기록을 서버가 집계만 한다 (새 표 없음). 인증 여부와 관계없는 개인 기록이고, 인증 완료 최대어에만 표시를 붙인다
 * - 순위·남과의 비교는 하지 않는다. 안 잡은 어종은 흐리게만 보여주고 「도전 과제」로 압박하지 않는다
 */
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRecordSummary } from '@/api/queries';
import type { SpeciesRecord } from '@/api/types';
import { AuthGate } from '@/components/login-required';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';
import { SpeciesImage } from '@/components/species';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { SPECIES, type SpeciesItem } from '@/lib/species';

const norm = (s: string) => s.replace(/\s|\(.*\)/g, '');

/** 기록 어종 → 앱 어종 목록 항목 (기준표 코드 또는 이름으로) */
function matchItem(r: SpeciesRecord): SpeciesItem | null {
  return (
    SPECIES.find((s) => r.species_code && s.speciesCode === r.species_code) ??
    SPECIES.find((s) => norm(s.name) === norm(r.species_name) || (s.alias && norm(s.alias) === norm(r.species_name))) ??
    null
  );
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

function Body() {
  const theme = useTheme();
  const q = useRecordSummary();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data;
  if (s.journal_count === 0) return <EmptyView message="아직 기록이 없어요. 다녀온 날을 기록하면 여기에 쌓여요." />;

  const caught = new Map<string, SpeciesRecord>();
  const extras: SpeciesRecord[] = [];
  for (const r of s.species) {
    const item = matchItem(r);
    if (item) caught.set(item.code, r);
    else extras.push(r);
  }
  const open = (id: number) => router.push({ pathname: '/journal/[id]', params: { id: String(id) } });

  return (
    <>
      <Card style={styles.stats}>
        <Stat value={s.trip_days} unit="일" label="출조" />
        <Stat value={s.species.length} unit="종" label="잡은 어종" />
        <Stat value={s.skunk_days} unit="일" label="못 잡은 날" />
      </Card>
      {s.first_trip ? (
        <ThemedText type="small" themeColor="textSecondary">
          {s.first_trip.replaceAll('-', '.')} 첫 기록부터 · 기록 {s.journal_count}건
        </ThemedText>
      ) : null}

      <SectionHeader title={`내 어종 도감 ${caught.size + extras.length}/${SPECIES.length + extras.length}`} />
      <ThemedText type="small" themeColor="textSecondary">
        잡은 어종은 처음 잡은 날과 내 최대어를 보여줘요. 누르면 그 기록으로 가요.
      </ThemedText>
      <View style={styles.grid}>
        {SPECIES.map((sp) => {
          const r = caught.get(sp.code);
          return (
            <Pressable
              key={sp.code}
              accessibilityRole={r ? 'button' : undefined}
              accessibilityLabel={r ? `${sp.name}, 처음 ${shortDate(r.first_at)}` : `${sp.name}, 아직 기록 없음`}
              disabled={!r}
              onPress={() => r && open(r.best_journal_id ?? r.first_journal_id)}
              style={({ pressed }) => [
                styles.cell,
                { borderColor: r ? theme.tint : theme.border, backgroundColor: theme.backgroundElement },
                !r && styles.dim,
                pressed && styles.pressed,
              ]}>
              <SpeciesImage code={sp.code} size={56} label={sp.name} />
              <ThemedText type="smallBold" numberOfLines={1}>
                {sp.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {r ? (r.best_length_cm != null ? `최대 ${r.best_length_cm}cm` : shortDate(r.first_at)) : '–'}
              </ThemedText>
            </Pressable>
          );
        })}
        {extras.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            onPress={() => open(r.best_journal_id ?? r.first_journal_id)}
            style={({ pressed }) => [
              styles.cell,
              { borderColor: theme.tint, backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <SpeciesImage code={null} size={56} label={r.species_name} />
            <ThemedText type="smallBold" numberOfLines={1}>
              {r.species_name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {r.best_length_cm != null ? `최대 ${r.best_length_cm}cm` : shortDate(r.first_at)}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {s.species.length ? (
        <>
          <SectionHeader title="어종별 기록" />
          {s.species.map((r) => (
            <Card key={r.key} style={styles.row}>
              <ThemedText type="smallBold">{r.species_name}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => open(r.first_journal_id)} hitSlop={6}>
                <ThemedText type="small" themeColor="tint">
                  첫 포획 {shortDate(r.first_at)} ›
                </ThemedText>
              </Pressable>
              {r.best_journal_id != null && r.best_length_cm != null ? (
                <Pressable accessibilityRole="button" onPress={() => open(r.best_journal_id!)} hitSlop={6}>
                  <ThemedText type="small" themeColor="tint">
                    내 최대어 {r.best_length_cm}cm · {shortDate(r.best_at!)}
                    {r.best_verified ? ' · ✓ 인증' : ''} ›
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  길이를 적은 기록이 없어요
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                기록 {r.journal_count}건{r.catch_count ? ` · ${r.catch_count}마리` : ''}
              </ThemedText>
            </Card>
          ))}
        </>
      ) : null}
    </>
  );
}

function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="value">
        {value}
        <ThemedText type="smallBold">{unit}</ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export default function MyRecordsScreen() {
  return (
    <AuthGate message="내 낚시 요약은 로그인 후 볼 수 있어요." icon="write">
      <StackScreen>
        <Stack.Screen options={{ title: '내 낚시 요약' }} />
        <Body />
      </StackScreen>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2, minWidth: 80 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31%', borderWidth: 1.5, borderRadius: 12, padding: 8, alignItems: 'center', gap: 2 },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  row: { gap: 4 },
});
