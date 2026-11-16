import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useDateRange, useTripOutlook, useTrips } from '@/api/queries';
import type { TripListItem } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { LoginRequired } from '@/components/login-required';
import { Card, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dayLabel } from '@/lib/compare';
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
    <TabScreen title="출조계획" onRefresh={() => qc.invalidateQueries({ queryKey: ['trips'] })}>
      <DraftCard />
      {status === 'loading' ? <Loading /> : status === 'signed-in' ? <TripList /> : <GuestIntro />}
    </TabScreen>
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
      <Button label="새 출조계획 만들기" icon="trips" onPress={() => router.push('/trip/new')} />
      <Card style={styles.intro}>
        <AppIcon name="trips" size={40} />
        <ThemedText type="sectionTitle">날짜와 낚시터를 정해 두면 그날 해황을 계속 보여드려요</ThemedText>
        {[
          '날짜별로 낚시터를 담고 주 장소·예비 장소를 나눠요',
          '그날의 파고·풍속 예보, 물때, 해상 특보를 장소마다 확인해요 (예보 전이면 발표 전으로 표시)',
          '두 곳을 같은 날 나란히 비교해요',
          '준비물을 체크하고, 다녀온 뒤 바로 기록을 남겨요',
        ].map((t) => (
          <ThemedText key={t} type="small" themeColor="textSecondary" style={styles.self}>
            • {t}
          </ThemedText>
        ))}
      </Card>
      <LoginRequired
        title="저장한 계획을 보려면 로그인"
        message="계획은 계정에 저장돼 다른 기기에서도 볼 수 있어요. 작성은 로그인 없이 시작하고, 저장할 때 로그인하면 돼요."
        icon="trips"
      />
    </>
  );
}

function TripList() {
  const upcoming = useTrips('upcoming');
  const past = useTrips('past');
  const range = useDateRange();
  const [showPast, setShowPast] = useState(false);
  const today = range.data?.today ?? '';
  return (
    <>
      <Button label="새 출조계획" icon="trips" onPress={() => router.push('/trip/new')} />
      <Button label="초대 코드로 참여" variant="secondary" onPress={() => router.push('/trip/join')} />
      <RecordPrompt trips={[...(past.data ?? []), ...(upcoming.data ?? [])]} today={today} />
      <SectionHeader title="다가오는 계획" />
      {upcoming.isPending ? (
        <Loading />
      ) : upcoming.isError ? (
        <ErrorView message={upcoming.error.message} onRetry={() => upcoming.refetch()} />
      ) : upcoming.data.length === 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            다가오는 계획이 없어요. 홈에서 출조 후보를 보고 「출조계획에 추가」를 누르거나, 위 버튼으로 만들어 보세요.
          </ThemedText>
        </Card>
      ) : (
        upcoming.data.map((t) => <TripCard key={t.id} t={t} today={today} />)
      )}

      <Pressable accessibilityRole="button" onPress={() => setShowPast((v) => !v)} style={styles.pastToggle}>
        <ThemedText type="sectionTitle">지난 계획 {past.data ? `${past.data.length}` : ''}</ThemedText>
        <ThemedText themeColor="textSecondary">{showPast ? '접기 ▲' : '펼치기 ▼'}</ThemedText>
      </Pressable>
      {showPast
        ? (past.data ?? []).map((t) => <TripCard key={t.id} t={t} today={today} />)
        : null}
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
  const when = t.end_date >= today ? '오늘' : t.end_date === daysAgo(today, 1) ? '어제' : dayLabel(t.end_date);
  return (
    <View style={[styles.card, { borderColor: theme.tint, backgroundColor: theme.tintSoft }]}>
      <ThemedText type="smallBold">
        {when} 다녀온 「{t.title}」 기록을 남길까요?
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        못 잡은 날도 기록해 두면 다음 출조 때 그날 바다를 다시 볼 수 있어요.
      </ThemedText>
      <View style={styles.promptActions}>
        <View style={styles.flex}>
          <Button label="기록 남기기" onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } })} />
        </View>
        <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={8} style={styles.promptClose}>
          <ThemedText type="small" themeColor="textSecondary">
            다음에
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function TripCard({ t, today }: { t: TripListItem; today: string }) {
  const theme = useTheme();
  const [criteria] = useCriteria();
  const upcoming = t.end_date >= today;
  // 다가오는 계획만 첫 장소 해황 요약을 불러온다
  const outlook = useTripOutlook(upcoming && t.first_stop ? t.id : NaN);
  const first = t.first_stop;
  const line = first && upcoming ? outlookLine(outlook.data?.stops.find((o) => o.stop_id === first.id), criteria, outlook.data?.forecast_last_day ?? null) : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } })}
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.cardHead}>
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
          {t.title}
        </ThemedText>
        <View style={[styles.dday, { backgroundColor: upcoming ? Brand.orange : theme.backgroundSelected }]}>
          <ThemedText type="small" style={upcoming ? styles.ddayOn : undefined}>
            {dday(t.start_date, t.end_date, today)}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {periodLabel(t.start_date, t.end_date)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.member_count > 1 ? `함께 ${t.member_count}명${t.my_role === 'member' ? ' · 초대받은 계획' : ''} · ` : ''}
        장소 {t.stop_count}곳 · 준비물 {t.checklist_done}/{t.checklist_total}
        {t.journal_count ? ` · 기록 ${t.journal_count}개` : ''}
      </ThemedText>
      {first ? (
        <ThemedText type="small" numberOfLines={2}>
          {dayLabel(first.day)} {first.place.name}
          {line ? <ThemedText type="small" themeColor={line.tone}>{` · ${line.text}`}</ThemedText> : null}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  promptActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promptClose: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  self: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  intro: { alignItems: 'center', gap: 8 },
  pastToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dday: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  ddayOn: { color: '#fff', fontWeight: '700' },
});
