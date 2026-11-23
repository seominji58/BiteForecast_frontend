/**
 * 금어기·금지체장 (수산자원관리법 시행령 별표1·2 요약, 2026-11-23).
 * - 위: 오늘 금어기 · 30일 안에 시작하는 금어기 · 고시로 정하는 어종(기간 확인 필요)
 * - 아래: 월별 전체 금어기 · 금지체장 · 재는 법 · 출처(개정일)·법령 원문 링크
 * - 법령 요약이므로 어업 방법·해역 예외는 원문 확인으로 안내한다 (낚시인에게 틀린 「괜찮아요」를 주지 않게)
 */
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useDateRange, useFishingRules } from '@/api/queries';
import { Card, ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { activeBans, periodText, upcomingBans, type BanRule } from '@/lib/rules';

const GROUPS = ['어류', '갑각류', '패류', '기타', '해조류'];

export default function RulesScreen() {
  const q = useFishingRules();
  const range = useDateRange();
  const theme = useTheme();
  const { name } = useLocalSearchParams<{ name?: string }>();
  if (q.isPending || range.isPending) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  const r = q.data;
  const today = range.data?.today ?? new Date().toISOString().slice(0, 10);
  const now = activeBans(r, today);
  const soon = upcomingBans(r, today, 30);
  const noticed = r.ban.filter((b) => b.notice);
  const hl = (n: string) => (name && n === name ? { backgroundColor: theme.backgroundSelected } : null);

  return (
    <StackScreen>
      <View style={[styles.warnBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="small">{r.notice}</ThemedText>
      </View>

      <SectionHeader title={`오늘 금어기 ${now.length}종`} />
      <Card style={styles.card}>
        {now.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            오늘은 시행령에 정한 금어기 어종이 없어요. 고시로 정하는 어종은 아래를 확인하세요.
          </ThemedText>
        ) : (
          now.map((a) => (
            <Row key={a.rule.name} title={a.rule.name} sub={a.periods.map(periodText).join(' · ')} note={a.rule.note} tone="danger" style={hl(a.rule.name)} />
          ))
        )}
      </Card>

      {soon.length ? (
        <>
          <SectionHeader title="30일 안에 시작" />
          <Card style={styles.card}>
            {soon.map((u) => (
              <Row key={u.rule.name} title={`${u.rule.name} · ${u.inDays}일 뒤`} sub={periodText(u.period)} note={u.rule.note} tone="warning" style={hl(u.rule.name)} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="고시로 기간이 정해지는 어종" />
      <Card style={styles.card}>
        {noticed.map((b) => (
          <Row key={b.name} title={b.name} sub={b.note ?? b.periods.map(periodText).join(' · ')} style={hl(b.name)} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          실제 기간은 해양수산부·시도 고시로 정해져요. 출조 전에 해당 지자체 공고를 확인하세요.
        </ThemedText>
      </Card>

      {r.female?.length ? (
        <>
          <SectionHeader title="연중 금지 · 암컷" />
          <Card style={styles.card}>
            {r.female.map((f) => (
              <Row key={f.name} title={f.name} sub={f.rule} tone="danger" style={hl(f.name)} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="전체 금어기" />
      {GROUPS.map((g) => {
        const list = r.ban.filter((b) => b.group === g && !b.notice);
        return list.length ? (
          <Card key={g} style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {g}
            </ThemedText>
            {list.map((b: BanRule) => (
              <Row key={b.name} title={b.name} sub={b.periods.map(periodText).join(' · ')} note={b.note} style={hl(b.name)} />
            ))}
          </Card>
        ) : null;
      })}

      <SectionHeader title="금지체장 · 이 크기 이하는 놓아주세요" />
      {GROUPS.map((g) => {
        const list = r.size.filter((s) => s.group === g);
        return list.length ? (
          <Card key={g} style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {g}
            </ThemedText>
            {list.map((s) => (
              <Row key={s.name} title={s.name} sub={`${s.limit} · ${s.measure}`} note={s.note} style={hl(s.name)} />
            ))}
          </Card>
        ) : null;
      })}

      {r.exemption_note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {r.exemption_note}
        </ThemedText>
      ) : null}

      <SectionHeader title="재는 법" />
      <Card style={styles.card}>
        {[...new Map(r.size.map((s) => [s.measure, s.measure_desc])).entries()].map(([m, d]) => (
          <ThemedText key={m} type="small">
            <ThemedText type="smallBold">{m}</ThemedText> · {d}
          </ThemedText>
        ))}
      </Card>

      <ThemedText type="small" themeColor="textSecondary">
        출처: {r.source} · {r.checked_at} 확인
      </ThemedText>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(r.law_url).catch(() => {})} style={styles.link}>
        <ThemedText type="smallBold" themeColor="tint">
          국가법령정보센터에서 원문 보기 ›
        </ThemedText>
      </Pressable>
    </StackScreen>
  );
}

function Row({
  title,
  sub,
  note,
  tone,
  style,
}: {
  title: string;
  sub: string;
  note?: string | null;
  tone?: 'danger' | 'warning';
  style?: object | null;
}) {
  return (
    <View style={[styles.row, style]}>
      <ThemedText type="smallBold" themeColor={tone}>
        {title}
      </ThemedText>
      <ThemedText type="small">{sub}</ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { gap: 2, borderRadius: 6, paddingVertical: 2 },
  warnBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  link: { minHeight: 40, justifyContent: 'center' },
});
