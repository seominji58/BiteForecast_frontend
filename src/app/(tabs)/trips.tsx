import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDateRange, useTripOutlook, useTrips } from '@/api/queries';
import type { TripListItem } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { LoginRequired } from '@/components/login-required';
import { Button } from '@/components/form';
import { SpotsCard, WeekCard } from '@/components/home-briefing';
import { ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dayLabel, dayList } from '@/lib/compare';
import { useExplore } from '@/lib/explore';
import { read, useCriteria, write } from '@/lib/prefs';
import { dday, outlookLine, periodLabel } from '@/lib/trip';
import { useTripDraft } from '@/lib/trip-draft';

/**
 * 출조계획 탭 (설계안 §5-1): 다가오는 계획 + 지난 계획.
 * 홈 = 전체 탐색, 출조계획 = 내가 정한 날짜·장소 관리, 비교 = 두 곳 나란히(계획에서 연다), 기록 = 다녀온 결과
 */
export default function TripsTab() {
  const { status } = useAuth();
  const qc = useQueryClient();
  return (
    <TabScreen
      title="출조계획"
      onRefresh={() => qc.invalidateQueries({ queryKey: ['trips'] })}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 출조계획 만들기"
          hitSlop={8}
          onPress={() => router.push('/trip/new')}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}>
          <UiIcon name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newBtnText}>계획 만들기</Text>
        </Pressable>
      }>
      <DraftCard />
      {status === 'loading' ? <Loading /> : status === 'signed-in' ? <TripList /> : <GuestIntro />}
      <WhenToGo />
    </TabScreen>
  );
}

/**
 * 언제 갈까 (2026-11-23, 홈에서 옮김): 앞으로 7일 공식 낚시지수 「좋음 이상」 지점 수를 날짜별 막대로.
 * 날짜를 누르면 그날 좋은 곳과 「이 날로 계획 만들기」. 어종·지역은 홈에서 고른 것을 그대로 쓴다
 */
function WhenToGo() {
  const range = useDateRange();
  const today = range.data?.today;
  const [sel, setSel] = useState<string | undefined>();
  const date = sel ?? today;
  const x = useExplore(date, today);
  const dates = range.data ? dayList(range.data.today, range.data.max) : [];
  if (!today) return null;
  return (
    <>
      <SectionHeader title={`언제 갈까${x.species ? ` · ${x.species.name}` : ''}`} />
      <WeekCard x={x} dates={dates} date={date} today={today} onDate={setSel} />
      <SpotsCard x={x} dates={dates} date={date} today={today} />
      <Button
        label={`${date ? dayLabel(date) : ''} 계획 만들기`}
        onPress={() => router.push({ pathname: '/trip/new', params: { date, ...(x.species ? { species: x.species.code } : {}) } })}
      />
    </>
  );
}

/** 작성하던 계획 이어 쓰기 (기기의 임시 저장본 — 7일·지난 일정이면 자동 삭제) */
function DraftCard() {
  const { draft } = useTripDraft();
  const theme = useTheme();
  if (!draft) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/trip/new')}
      style={({ pressed }) => [styles.card, { borderColor: theme.tint, backgroundColor: theme.tintSoft }, pressed && styles.pressed]}>
      <ThemedText type="smallBold" themeColor="tint">
        작성하던 계획이 있어요 · 이어서 저장 ›
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {periodLabel(draft.start, draft.end)}
        {draft.region ? ` · ${draft.region}` : ''}
      </ThemedText>
    </Pressable>
  );
}

/** 로그인 전: 무엇을 하는 곳인지 (실제처럼 보이는 예시 데이터는 쓰지 않는다). 작성은 로그인 없이 시작할 수 있다 */
function GuestIntro() {
  return (
    <>
      <EmptyTrips
        title="출조계획을 만들어 보세요"
        message={
          '날짜와 낚시터를 정해 두면 그날 파고·풍속·물때·특보를 계속 보여드려요.\n작성은 로그인 없이 시작하고, 저장할 때 로그인하면 돼요.'
        }
      />
      <LoginRequired title="저장한 계획을 보려면 로그인" message="계획은 계정에 저장돼 다른 기기에서도 볼 수 있어요." icon="trips" />
    </>
  );
}

/** 빈 상태 (레퍼런스: 그림 + 두 줄 + 「+ 계획 만들기」) */
function EmptyTrips({ title, message }: { title: string; message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.emptyArt, { backgroundColor: theme.tintSoft }]}>
        <AppIcon name="trips" size={44} />
      </View>
      <ThemedText type="smallBold" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/trip/new')}
        style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}>
        <UiIcon name="add" size={16} color="#FFFFFF" />
        <Text style={styles.newBtnText}>계획 만들기</Text>
      </Pressable>
    </View>
  );
}

function TripList() {
  const theme = useTheme();
  const upcoming = useTrips('upcoming');
  const past = useTrips('past');
  const range = useDateRange();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const today = range.data?.today ?? '';
  const list = tab === 'upcoming' ? upcoming : past;
  const count = (q: typeof upcoming) => (q.data ? ` (${q.data.length})` : '');
  return (
    <>
      <View style={styles.joinRow}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/trip/join')} style={styles.join}>
          <UiIcon name="qr" size={16} color={theme.text} />
          <ThemedText type="smallBold">초대 코드로 참여</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.joinHint} numberOfLines={1}>
          내가 초대하려면 계획 › 동행 › 친구 초대
        </ThemedText>
      </View>
      <View style={[styles.seg, { backgroundColor: theme.backgroundSelected }]}>
        {(
          [
            ['upcoming', `예정·진행중${count(upcoming)}`],
            ['past', `지난 계획${count(past)}`],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(key)}
              style={[styles.segItem, on && { backgroundColor: Brand.navy }]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={on ? styles.onNavy : undefined}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {tab === 'upcoming' ? <RecordPrompt trips={[...(past.data ?? []), ...(upcoming.data ?? [])]} today={today} /> : null}
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorView message={list.error.message} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyTrips title="등록된 출조계획이 없어요." message="새로운 출조계획을 만들어 낚시를 준비해 보세요!" />
        ) : (
          <View style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              지난 계획이 없어요.
            </ThemedText>
          </View>
        )
      ) : (
        list.data.map((t) => <TripCard key={t.id} t={t} today={today} />)
      )}
    </>
  );
}

const PROMPT_DISMISSED = 'biteforecast.record_prompt_dismissed';
const PROMPT_DAYS = 7;

function daysAgo(today: string, n: number): string {
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 다녀온 계획 기록 유도 (서비스 개선 설계 T1, 알림 없이 화면 안에서만).
 * 최근 7일 안에 시작한 계획 중 내 기록이 없는 가장 최근 것 하나. 닫으면 그 계획은 다시 묻지 않는다 (기기 저장)
 */
function RecordPrompt({ trips, today }: { trips: TripListItem[]; today: string }) {
  const theme = useTheme();
  const [dismissed, setDismissed] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true;
    read(PROMPT_DISMISSED)
      .then((x) => alive && setDismissed(x ? (JSON.parse(x) as number[]) : []))
      .catch(() => alive && setDismissed([]));
    return () => {
      alive = false;
    };
  }, []);
  if (!today || dismissed == null) return null;
  const since = daysAgo(today, PROMPT_DAYS);
  const t = trips
    .filter((x) => x.start_date <= today && x.end_date >= since && x.journal_count === 0 && !dismissed.includes(x.id))
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
  if (!t) return null;
  const dismiss = () => {
    const next = [t.id, ...dismissed].slice(0, 50);
    setDismissed(next);
    write(PROMPT_DISMISSED, JSON.stringify(next)).catch(() => undefined);
  };
  const isToday = t.start_date <= today && t.end_date >= today;
  const when = t.end_date >= today ? '오늘' : t.end_date === daysAgo(today, 1) ? '어제' : dayLabel(t.end_date);
  const first = t.first_stop;
  const writeRecord = () =>
    first && first.day <= today
      ? router.push({ pathname: '/journal/new', params: { place: String(first.place.id), date: first.day, trip_stop: String(first.id) } })
      : router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } });
  return (
    <View style={[styles.banner, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.bannerIcon, { backgroundColor: theme.tintSoft }]}>
        <UiIcon name="calendar" size={20} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {isToday ? '오늘은 출조 예정일이에요!' : `${when} 다녀온 출조, 기록할까요?`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {t.title}
        </ThemedText>
      </View>
      <Pressable accessibilityRole="button" onPress={writeRecord} style={({ pressed }) => [styles.bannerBtn, pressed && styles.pressed]}>
        <Text style={styles.bannerBtnText}>기록 작성</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="다음에" onPress={dismiss} hitSlop={10} style={styles.bannerClose}>
        <ThemedText type="small" themeColor="textSecondary">
          ✕
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** D-day 표시 색: 진행 중·당일 = 주황, 다가오는 날 = 틸, 지난 계획 = 회색 */
function ddayTone(t: TripListItem, today: string): string | null {
  if (t.end_date < today) return null;
  return t.start_date <= today ? Brand.orange : Brand.teal;
}

function TripCard({ t, today }: { t: TripListItem; today: string }) {
  const theme = useTheme();
  const [criteria] = useCriteria();
  const upcoming = t.end_date >= today;
  // 다가오는 계획만 첫 장소 해황 요약을 불러온다
  const outlook = useTripOutlook(upcoming && t.first_stop ? t.id : NaN);
  const first = t.first_stop;
  const line =
    first && upcoming
      ? outlookLine(
          outlook.data?.stops.find((o) => o.stop_id === first.id),
          criteria,
          outlook.data?.forecast_last_day ?? null,
        )
      : null;
  const tone = ddayTone(t, today);
  const [, m, d] = t.start_date.split('-').map(Number);
  const where = [t.region, first ? first.place.name : null].filter(Boolean).join(' · ') || '장소 미정';
  const ratio = t.checklist_total ? t.checklist_done / t.checklist_total : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${dday(t.start_date, t.end_date, today)}, ${periodLabel(t.start_date, t.end_date)}, ${where}`}
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } })}
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {/* 사진 대신 날짜 타일 (계획에 사진 자료가 없어 가짜 사진을 쓰지 않는다) */}
      <View style={[styles.dateTile, { backgroundColor: upcoming ? Brand.navy : theme.backgroundSelected }]}>
        <Text style={[styles.tileMonth, !upcoming && { color: theme.textSecondary }]}>{m}월</Text>
        <Text style={[styles.tileDay, !upcoming && { color: theme.textSecondary }]}>{d}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <ThemedText type="bodyBold" style={styles.flex} numberOfLines={1}>
            {t.title}
          </ThemedText>
          <View style={[styles.dday, { backgroundColor: tone ?? theme.backgroundSelected }]}>
            <Text style={[styles.ddayText, !tone && { color: theme.textSecondary }]}>{dday(t.start_date, t.end_date, today)}</Text>
          </View>
        </View>
        <InfoLine icon="calendar" text={periodLabel(t.start_date, t.end_date)} />
        <InfoLine icon="pin" text={where} />
        {t.member_count > 1 ? (
          <InfoLine icon="people" text={`함께 ${t.member_count}명${t.my_role === 'member' ? ' · 초대받은 계획' : ''}`} />
        ) : null}
        {line ? (
          <ThemedText type="caption" themeColor={line.tone} numberOfLines={1}>
            {line.text}
          </ThemedText>
        ) : null}
        <View style={styles.progressRow}>
          <ThemedText type="caption" themeColor="textSecondary">
            준비물 {t.checklist_done}/{t.checklist_total}
            {t.journal_count ? ` · 기록 ${t.journal_count}` : ''}
          </ThemedText>
          <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: Brand.teal }]} />
          </View>
        </View>
      </View>
      <UiIcon name="chevron" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function InfoLine({ icon, text }: { icon: 'calendar' | 'pin' | 'people'; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.info}>
      <UiIcon name={icon} size={15} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
  onNavy: { color: Brand.onNavy },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Brand.orange,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 14,
    minHeight: 34,
  },
  newBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  joinRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -4, marginBottom: -4 },
  joinHint: { flexShrink: 1 },
  join: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  bannerIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bannerBtn: { backgroundColor: Brand.orange, borderRadius: 10, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  bannerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  bannerClose: { minHeight: 36, justifyContent: 'center', paddingLeft: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  dateTile: { width: 64, height: 76, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileMonth: { color: Brand.onNavySecondary, fontSize: 13, fontWeight: '700' },
  tileDay: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '800' },
  cardBody: { flex: 1, gap: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  dday: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  ddayText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  bar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 24, paddingHorizontal: 16 },
  emptyArt: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.orange,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 40,
    marginTop: 6,
  },
});
