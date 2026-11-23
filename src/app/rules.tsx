/**
 * 금어기·금지체장 (수산자원관리법 시행령 별표1·2·고시 요약) — 2026-11-23 재설계.
 * 길게 늘어놓던 표 대신
 *   맨 위 한 줄 안내(누르면 법령 요약·출처 시트) → [지금][월별][크기] 탭 → 어종 타일(2열)
 * 타일을 누르면 그 어종의 전체 기간·예외·금지체장·재는 법을 시트로 본다.
 * 법령 요약이므로 예외는 원문 확인으로 안내한다 (틀린 「괜찮아요」를 주지 않게)
 */
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDateRange, useFishingRules } from '@/api/queries';
import type { FishingRules } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorView, Loading } from '@/components/screen';
import { SegmentTabs } from '@/components/segment-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { activeBans, inPeriod, periodText, upcomingBans } from '@/lib/rules';
import { monthHasBan } from '@/lib/seasons';

type Tab = 'now' | 'month' | 'size';
const TABS: { value: Tab; label: string }[] = [
  { value: 'now', label: '지금' },
  { value: 'month', label: '월별' },
  { value: 'size', label: '크기' },
];

export default function RulesScreen() {
  const q = useFishingRules();
  const range = useDateRange();
  const theme = useTheme();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const [tab, setTab] = useState<Tab>('now');
  const [detail, setDetail] = useState<string | null>(name ?? null);
  const [info, setInfo] = useState(false);
  const today = range.data?.today ?? new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  if (q.isPending || range.isPending) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  const r = q.data;
  const year = Number(today.slice(0, 4));
  const now = activeBans(r, today);
  const soon = upcomingBans(r, today, 30);
  const sizeOf = (n: string) => r.size.find((s) => s.name === n)?.limit;

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setInfo(true)}
          style={[styles.notice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="regulation" size={20} />
          <ThemedText type="small" style={styles.flex} numberOfLines={2}>
            법령 요약이에요. 금어기·금지체장 이하는 바로 놓아주세요.
          </ThemedText>
          <ThemedText type="smallBold" themeColor="tint">
            자세히 ›
          </ThemedText>
        </Pressable>

        <SegmentTabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'now' ? (
          <>
            <Head title={`오늘 금어기 ${now.length}종`} />
            {now.length ? (
              <Tiles>
                {now.map((a) => (
                  <Tile
                    key={a.rule.name}
                    title={a.rule.name}
                    sub={a.periods.map(periodText).join(' · ')}
                    tone="danger"
                    onPress={() => setDetail(a.rule.name)}
                  />
                ))}
              </Tiles>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                오늘은 법으로 정한 금어기 어종이 없어요.
              </ThemedText>
            )}
            {soon.length ? (
              <>
                <Head title="30일 안에 시작" />
                <Tiles>
                  {soon.map((u) => (
                    <Tile
                      key={u.rule.name}
                      title={u.rule.name}
                      sub={`${u.inDays}일 뒤 · ${periodText(u.period)}`}
                      tone="warning"
                      onPress={() => setDetail(u.rule.name)}
                    />
                  ))}
                </Tiles>
              </>
            ) : null}
            {r.female?.length ? (
              <Row title="암컷은 연중 금지" sub={r.female.map((f) => f.name).join('·')} onPress={() => setDetail('__female')} />
            ) : null}
          </>
        ) : tab === 'month' ? (
          <>
            <View style={styles.months}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const on = m === month;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setMonth(m)}
                    style={[
                      styles.month,
                      { borderColor: on ? Brand.teal : theme.border, backgroundColor: on ? Brand.teal : theme.backgroundElement },
                    ]}>
                    <ThemedText type="smallBold" style={{ color: on ? '#FFFFFF' : theme.text }}>
                      {m}월
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <MonthList rules={r} year={year} month={month} onPick={setDetail} />
          </>
        ) : (
          <>
            <Head title="이 크기 이하는 놓아주세요" />
            <Tiles>
              {r.size.map((s) => (
                <Tile key={s.name} title={s.name} sub={`${s.limit} · ${s.measure}`} onPress={() => setDetail(s.name)} />
              ))}
            </Tiles>
          </>
        )}
      </ScrollView>

      <DetailSheet rules={r} name={detail} today={today} onClose={() => setDetail(null)} sizeOf={sizeOf} />

      <BottomSheet open={info} title="법령 요약 · 출처" onClose={() => setInfo(false)}>
        <ThemedText type="small">{r.notice}</ThemedText>
        {r.exemption_note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {r.exemption_note}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          고등어·넓미역처럼 해양수산부·시도 고시로 정하는 기간은 해마다 바뀔 수 있어요.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          출처: {r.source} · {r.checked_at} 확인
        </ThemedText>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(r.law_url).catch(() => {})} style={styles.link}>
          <ThemedText type="smallBold" themeColor="tint">
            국가법령정보센터에서 원문 보기 ›
          </ThemedText>
        </Pressable>
      </BottomSheet>
    </ThemedView>
  );
}

/** 그 달에 하루라도 금어기가 걸치는 어종 (고시 어종은 그해 기간만) */
function MonthList({ rules, year, month, onPick }: { rules: FishingRules; year: number; month: number; onPick: (n: string) => void }) {
  const list = rules.ban.map((b) => ({ b, ps: b.periods.filter((p) => monthHasBan(p, year, month)) })).filter((x) => x.ps.length);
  const unknown = rules.ban.filter((b) => b.notice && !b.periods.some((p) => p.year === year));
  return (
    <>
      <Head title={`${month}월 금어기 ${list.length}종`} />
      {list.length ? (
        <Tiles>
          {list.map(({ b, ps }) => (
            <Tile key={b.name} title={b.name} sub={ps.map(periodText).join(' · ')} tone="danger" onPress={() => onPick(b.name)} />
          ))}
        </Tiles>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {month}월에 걸치는 법정 금어기가 없어요.
        </ThemedText>
      )}
      {unknown.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {unknown.map((b) => b.name).join('·')}는 {year}년 고시 기간을 확인하세요.
        </ThemedText>
      ) : null}
    </>
  );
}

function DetailSheet({
  rules,
  name,
  today,
  onClose,
  sizeOf,
}: {
  rules: FishingRules;
  name: string | null;
  today: string;
  onClose: () => void;
  sizeOf: (n: string) => string | undefined;
}) {
  if (name === '__female') {
    return (
      <BottomSheet open title="암컷은 연중 금지" onClose={onClose}>
        {rules.female?.map((f) => (
          <ThemedText key={f.name} type="small">
            <ThemedText type="smallBold">{f.name}</ThemedText> · {f.rule}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          수산자원관리법 시행령 제6조 ③항
        </ThemedText>
      </BottomSheet>
    );
  }
  const ban = rules.ban.find((b) => b.name === name);
  const size = rules.size.find((s) => s.name === name);
  const now = ban?.periods.some((p) => inPeriod(p, today));
  return (
    <BottomSheet open={!!name && (!!ban || !!size)} title={name ?? ''} onClose={onClose}>
      {now ? (
        <ThemedText type="smallBold" themeColor="danger">
          ⚠ 지금 금어기예요
        </ThemedText>
      ) : null}
      {ban ? (
        <View style={styles.block}>
          <ThemedText type="smallBold">금어기</ThemedText>
          {ban.periods.map((p, i) => (
            <ThemedText key={i} type="small">
              {periodText(p)}
            </ThemedText>
          ))}
          {ban.note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {ban.note}
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          법정 금어기 없음
        </ThemedText>
      )}
      <View style={styles.block}>
        <ThemedText type="smallBold">금지체장</ThemedText>
        {size ? (
          <>
            <ThemedText type="small">{sizeOf(size.name)}는 놓아주세요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              재는 법: {size.measure} ({size.measure_desc}){size.note ? ` · ${size.note}` : ''}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            법정 금지체장 없음
          </ThemedText>
        )}
      </View>
    </BottomSheet>
  );
}

function Head({ title }: { title: string }) {
  return <ThemedText type="smallBold">{title}</ThemedText>;
}

function Tiles({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

function Tile({ title, sub, tone, onPress }: { title: string; sub: string; tone?: 'danger' | 'warning'; onPress: () => void }) {
  const theme = useTheme();
  const bg = tone === 'danger' ? theme.dangerSoft : tone === 'warning' ? theme.warningSoft : theme.backgroundElement;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: bg, borderColor: theme.border }, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor={tone ?? 'text'} numberOfLines={1}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {sub}
      </ThemedText>
    </Pressable>
  );
}

function Row({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  content: { padding: Layout.screenPadding, gap: Layout.gap, paddingBottom: Layout.gap * 3 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 52 },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  month: { width: '15%', flexGrow: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  block: { gap: 4 },
  link: { minHeight: 40, justifyContent: 'center' },
});
