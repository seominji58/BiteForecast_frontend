import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { useDateRange, useDeleteTrip, useFavorites, useTrip, useTripMutation, useTripOutlook } from '@/api/queries';
import type { ChecklistItem, StopOutlook, Trip, TripStop } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { BottomSheet } from '@/components/bottom-sheet';
import { CoordNote } from '@/components/coord-note';
import { StopSea } from '@/components/stop-sea';
import { OptionSheet } from '@/components/option-sheet';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { PlacePicker } from '@/components/place-picker';
import { Card, ErrorView, Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon, type UiIconName } from '@/components/ui-icon';
import { CatchStrip } from '@/components/catch-strip';
import { ownerName, participants, TripMembers } from '@/components/trip-members';
import { PlaceThumb } from '@/components/place-photo';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, timeLabel } from '@/lib/compare';
import { criteriaLabel } from '@/lib/criteria';
import { placeName, sidoOf } from '@/lib/place';
import { useCriteria } from '@/lib/prefs';
import { speciesForRecord } from '@/lib/species';
import { type Brief, dday, hmToDate, periodLabel, stopBrief, timeRange, toHm, tripDays } from '@/lib/trip';

const MAX_STOPS_PER_DAY = 5;

/** 출조계획 상세 (설계안 §5-3): 날짜별 장소 + 그날 해황 · 두 곳 비교 · 준비물 · 기록 남기기 */
function TripDetail() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = Number(params.id);
  const q = useTrip(id);
  const outlook = useTripOutlook(id);
  const range = useDateRange();
  if (q.isPending || !range.data) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  return <TripBody trip={q.data} outlook={outlook.data} today={range.data.today} initialTab={params.tab} />;
}

function TripBody({
  trip,
  outlook,
  today,
  initialTab,
}: {
  trip: Trip;
  outlook: ReturnType<typeof useTripOutlook>['data'];
  today: string;
  initialTab?: string;
}) {
  const theme = useTheme();
  const [criteria] = useCriteria();
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState<string | null>(null);
  const days = tripDays(trip.start_date, trip.end_date);
  // 처음 펼칠 날짜: 이틀 이하면 모두, 아니면 오늘 이후 첫날(없으면 첫날)
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set(days.length <= 2 ? days : [days.find((d) => d >= today) ?? days[0]]));
  // 한 화면에 모든 것을 늘어놓지 않게 탭으로 나눈다: 장소 · 함께 · 준비물
  // ?tab=members 로 열면 동행 탭부터 (계획을 만든 직후 「친구 초대」)
  // 준비물·동행은 시트로 (?tab=members 로 열면 동행 시트부터 — 계획을 만든 직후 「친구 초대」)
  const [sheet, setSheet] = useState<'checklist' | 'members' | null>(() =>
    initialTab === 'members' || initialTab === 'checklist' ? initialTab : null,
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [scrolled, setScrolled] = useState(false);
  const allOpen = openDays.size === days.length;
  // 장소 없는 날이 2일 넘게 이어지면 한 줄로 묶는다 (누르면 낱개로). 오늘·펼친 날은 묶지 않는다
  const [unfolded, setUnfolded] = useState(false);
  const emptyDay = (d: string) => !trip.stops.some((s) => s.day === d) && d !== today && !openDays.has(d);
  const groups: { start: number; days: string[] }[] = [];
  days.forEach((d, i) => {
    const last = groups[groups.length - 1];
    if (
      !unfolded &&
      emptyDay(d) &&
      last &&
      last.days.length &&
      emptyDay(last.days[last.days.length - 1]) &&
      last.start + last.days.length === i
    )
      last.days.push(d);
    else groups.push({ start: i, days: [d] });
  });
  const [editing, setEditing] = useState<TripStop | null>(null);
  const favorites = useFavorites();
  const del = useDeleteTrip();
  const mutate = useTripMutation((fn: () => Promise<Trip>) => fn());
  const run = (fn: () => Promise<Trip>) => mutate.mutate(fn, { onError: (e) => Alert.alert('저장하지 못했어요', e.message) });
  const byStop = new Map((outlook?.stops ?? []).map((o) => [o.stop_id, o]));
  // 함께 가는 계획: 계획·장소 수정과 삭제는 만든 사람만 (참여자는 보기 · 준비물 체크·담당 · 기록)
  const owner = trip.my_role === 'owner';

  const confirmDelete = () =>
    Alert.alert('계획을 지울까요?', '이 계획에서 쓴 기록은 지워지지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: () => del.mutate(trip.id, { onSuccess: () => router.back() }),
      },
    ]);

  const openMenu = () =>
    Alert.alert(trip.title, undefined, [
      { text: '계획 수정', onPress: () => router.push({ pathname: '/trip/new', params: { id: String(trip.id) } }) },
      { text: '계획 지우기', style: 'destructive', onPress: confirmDelete },
      { text: '닫기', style: 'cancel' },
    ]);

  // 대표 장소: 날짜순 → 주 장소 먼저
  const ordered = [...trip.stops].sort((x, y) =>
    x.day === y.day ? (x.role === y.role ? x.sort_order - y.sort_order : x.role === 'main' ? -1 : 1) : x.day.localeCompare(y.day),
  );
  const done = trip.checklist.filter((c) => c.checked).length;
  const people = participants(trip).length;
  const recordStop = ordered.find((s) => s.day <= today) ?? null;
  const writeRecord = () => {
    if (recordStop)
      router.push({
        pathname: '/journal/new',
        params: { place: String(recordStop.place.id), date: recordStop.day, trip_stop: String(recordStop.id) },
      });
    else if (trip.start_date <= today) router.push('/journal/new');
    else Alert.alert('출조 날부터 기록할 수 있어요', `${dayLabel(trip.start_date)}부터 이 계획의 기록을 남길 수 있어요.`);
  };
  const speciesName = trip.species_name ?? trip.species_etc;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          // 사진 위에서는 투명, 스크롤해서 사진이 지나가면 네이비로 채우고 제목을 보여준다 (글자 겹침 방지)
          title: scrolled ? trip.title : '',
          headerTransparent: true,
          headerStyle: { backgroundColor: scrolled ? Brand.navy : 'transparent' },
          // 계획 수정·지우기는 오른쪽 위 ⋯ (본문에 큰 빨간 버튼을 두지 않는다)
          headerRight: owner
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel="계획 메뉴" hitSlop={10} onPress={openMenu} style={styles.menuBtn}>
                  <UiIcon name="more" size={22} color="#FFFFFF" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y > 120;
          if (y !== scrolled) setScrolled(y);
        }}
        scrollEventThrottle={64}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {/* 머리: 바다 사진(분위기) 위에 D-day · 제목 · 날짜·지역·어종 */}
        <View style={[styles.hero, { paddingTop: headerHeight + 12 }]}>
          <Image source={require('../../../assets/home-backgrounds/dusk.png')} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.heroShade} />
          <View style={styles.dday}>
            <Text style={styles.ddayText}>{dday(trip.start_date, trip.end_date, today)}</Text>
          </View>
          {!owner ? <Text style={styles.heroSub}>{`${ownerName(trip) ?? '친구'}님의 출조 계획`}</Text> : null}
          <Text style={styles.heroTitle} accessibilityRole="header" numberOfLines={2}>
            {trip.title}
          </Text>
          <View style={styles.heroMeta}>
            <HeroMeta icon="calendar" text={periodLabel(trip.start_date, trip.end_date)} />
            {trip.region ? <HeroMeta icon="pin" text={trip.region} /> : null}
            {speciesName ? <HeroMeta icon="fish" text={speciesName} /> : null}
          </View>
        </View>

        {/* 일정: 날짜마다 한 줄 요약(주 장소 · 그날 바다 상태), 누르면 그날 낚시터 카드 (2026-11-24 탭 대신 한 화면) */}
        <View style={styles.sectionHead}>
          <ThemedText type="sectionTitle" style={styles.flex}>
            일정
          </ThemedText>
          {days.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setUnfolded(!allOpen);
                setOpenDays(allOpen ? new Set() : new Set(days));
              }}>
              <ThemedText type="smallBold" themeColor="tint">
                {allOpen ? '모두 접기' : '모두 펼치기'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        {groups.map(({ start, days: g }) => {
          if (g.length > 1) {
            return (
              <Pressable
                key={g[0]}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(g[0])}부터 ${dayLabel(g[g.length - 1])}까지 장소 없음, 펼치기`}
                onPress={() => setUnfolded(true)}
                style={({ pressed }) => [
                  styles.day,
                  styles.dayHead,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.dayBadge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    DAY {start + 1}–{start + g.length}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
                    {dayLabel(g[0])} ~ {dayLabel(g[g.length - 1])}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    아직 장소 없음{owner ? ' · 눌러서 날짜별로 추가' : ''}
                  </ThemedText>
                </View>
                <AppIcon name="arrow-down" size={12} />
              </Pressable>
            );
          }
          const day = g[0];
          const i = start;
          return (() => {
            // 주 장소 먼저, 그다음 예비 (각각 정한 순서대로)
            const stops = trip.stops
              .filter((s) => s.day === day)
              .sort((x, y) => (x.role === y.role ? x.sort_order - y.sort_order : x.role === 'main' ? -1 : 1));
            const mains = stops.filter((s) => s.role === 'main');
            const pair = stops.length >= 2 ? [stops[0], stops[1]] : null;
            const open = openDays.has(day);
            const head = stops[0] ?? null;
            const brief = head ? stopBrief(byStop.get(head.id), criteria, outlook?.forecast_last_day ?? null) : null;
            const names = stops.length
              ? `${(mains.length ? mains : stops).map((s) => s.place.name).join('·')}${stops.length > (mains.length || stops.length) ? ` 외 예비 ${stops.length - mains.length}곳` : ''}`
              : '장소 없음';
            return (
              <View key={day} style={[styles.day, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${dayLabel(day)}, ${names}, ${open ? '접기' : '펼치기'}`}
                  onPress={() => {
                    const next = new Set(openDays);
                    if (open) next.delete(day);
                    else next.add(day);
                    setOpenDays(next);
                  }}
                  style={({ pressed }) => [styles.dayHead, pressed && styles.pressed]}>
                  <View style={[styles.dayBadge, { backgroundColor: day === today ? Brand.orange : theme.tintSoft }]}>
                    <ThemedText
                      type="small"
                      themeColor={day === today ? undefined : 'tint'}
                      style={day === today ? styles.onNavy : undefined}>
                      {day === today ? '오늘' : `DAY ${i + 1}`}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {dayLabel(day)}
                      {day < today ? ' · 지남' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {names}
                      {brief?.mini ? ` · ${brief.mini}` : ''}
                    </ThemedText>
                  </View>
                  {brief ? <BriefChip b={brief} /> : null}
                  <AppIcon name="arrow-down" size={12} style={open ? styles.flip : undefined} />
                </Pressable>
                {open ? (
                  <View style={styles.dayBody}>
                    {stops.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        아직 고른 낚시터가 없어요.
                      </ThemedText>
                    ) : null}
                    {stops.map((s) => (
                      <StopCard
                        key={s.id}
                        stop={s}
                        o={byStop.get(s.id)}
                        lastDay={outlook?.forecast_last_day ?? null}
                        criteria={criteria}
                        today={today}
                        canEdit={owner}
                        onEdit={() => setEditing(s)}
                        onToggleRole={() =>
                          run(() => api.updateTripStop(trip.id, s.id, { role: s.role === 'main' ? 'alternative' : 'main' }))
                        }
                        onDelete={() =>
                          Alert.alert(`${s.place.name}을(를) 뺄까요?`, undefined, [
                            { text: '취소', style: 'cancel' },
                            { text: '빼기', style: 'destructive', onPress: () => run(() => api.deleteTripStop(trip.id, s.id)) },
                          ])
                        }
                      />
                    ))}
                    <View style={styles.dayActions}>
                      {owner && stops.length < MAX_STOPS_PER_DAY ? (
                        <ActionChip icon="add" label="장소 추가" onPress={() => setAddingDay(addingDay === day ? null : day)} />
                      ) : null}
                      {pair ? (
                        <ActionChip
                          icon="swap"
                          label="두 곳 비교"
                          onPress={() =>
                            router.push({
                              pathname: '/compare',
                              params: { a: String(pair[0].place.id), b: String(pair[1].place.id), date: day },
                            })
                          }
                        />
                      ) : null}
                    </View>
                    {addingDay === day ? (
                      // 장소 추가: 즐겨찾기 바로 넣기 + 검색 (검색 시트가 칩을 가리지 않게 따로 연다)
                      <View style={styles.wrap}>
                        {(favorites.data ?? []).slice(0, 5).map((p) => (
                          <Chip
                            key={p.id}
                            label={`★ ${p.name}`}
                            selected={false}
                            onPress={() => {
                              setAddingDay(null);
                              run(() => api.addTripStop(trip.id, { day, place_id: p.id, role: stops.length ? 'alternative' : 'main' }));
                            }}
                          />
                        ))}
                        <Chip label="낚시터 검색…" selected={false} onPress={() => setPickingDay(day)} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })();
        })}
        <ThemedText type="caption" themeColor="textSecondary">
          {outlook?.data_status.forecast_issued_at ? `기상청 ${formatIssued(outlook.data_status.forecast_issued_at)} 발표 · ` : ''}내 기준{' '}
          {criteriaLabel(criteria)} · 해황·물때는 참고 자료예요
        </ThemedText>

        {/* 준비물 · 동행 · 메모: 한 줄씩, 누르면 시트 */}
        <Card style={styles.overview}>
          <OverviewRow icon="check" label="준비물" value={`${done}/${trip.checklist.length} 챙김`} onPress={() => setSheet('checklist')}>
            <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.barFill, { width: `${trip.checklist.length ? (done / trip.checklist.length) * 100 : 0}%` }]} />
            </View>
          </OverviewRow>
          <OverviewRow
            icon="people"
            label="동행"
            value={owner ? `${people}명 · 친구 초대` : `${people}명`}
            onPress={() => setSheet('members')}
            divider
          />
          {trip.memo ? <OverviewRow icon="memo" label="메모" value={trip.memo} divider /> : null}
        </Card>

        {/* 출조 전 참고: 첫 장소 시·도와 목표 어종의 최근 이용자 조황 (예보와 구분, 없으면 숨김) */}
        {trip.stops[0] ? (
          <CatchStrip
            title={`${sidoOf(trip.stops[0].place)} 최근 이용자 조황`}
            filter={{
              sido: sidoOf(trip.stops[0].place),
              species: speciesForRecord(trip.species_code, trip.species_etc) ? (trip.species_code ?? trip.species_etc) : null,
            }}
            note="이용자가 올린 조황이에요. 예보가 아니에요."
          />
        ) : null}
      </ScrollView>

      {/* 아래 고정: 계획 수정 · 기록 작성 */}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) },
        ]}>
        {owner ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/trip/new', params: { id: String(trip.id) } })}
            style={({ pressed }) => [styles.footBtn, styles.footPrimary, pressed && styles.pressed]}>
            <UiIcon name="edit" size={18} color="#FFFFFF" />
            <Text style={styles.footPrimaryText}>계획 수정</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={writeRecord}
          style={({ pressed }) => [
            styles.footBtn,
            { borderColor: Brand.navy, borderWidth: 1.5, backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <UiIcon name="camera" size={18} color={theme.text} />
          <ThemedText type="smallBold">기록 작성</ThemedText>
        </Pressable>
      </View>

      <PlacePicker
        visible={pickingDay !== null}
        title={pickingDay ? `${dayLabel(pickingDay)}에 넣을 낚시터` : ''}
        onSelect={(p) => {
          const day = pickingDay!;
          const has = trip.stops.some((s) => s.day === day);
          setPickingDay(null);
          setAddingDay(null);
          run(() => api.addTripStop(trip.id, { day, place_id: p.id, role: has ? 'alternative' : 'main' }));
        }}
        onClose={() => setPickingDay(null)}
      />
      <BottomSheet open={sheet === 'checklist'} title={`준비물 ${done}/${trip.checklist.length}`} onClose={() => setSheet(null)}>
        <Checklist trip={trip} run={run} />
      </BottomSheet>
      <BottomSheet open={sheet === 'members'} title={`함께 가는 사람 ${people}명`} onClose={() => setSheet(null)}>
        <TripMembers trip={trip} run={run} />
      </BottomSheet>
      <StopEditor
        stop={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          const s = editing!;
          setEditing(null);
          run(() => api.updateTripStop(trip.id, s.id, patch));
        }}
      />
    </ThemedView>
  );
}

function formatIssued(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function HeroMeta({ icon, text }: { icon: 'calendar' | 'pin' | 'fish'; text: string }) {
  return (
    <View style={styles.heroMetaItem}>
      <UiIcon name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.heroMetaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** 개요 한 줄: 아이콘 · 이름 · 값 · (오른쪽 동작 또는 ›) */
function OverviewRow({
  icon,
  label,
  value,
  onPress,
  action,
  divider,
  children,
}: {
  icon: 'pin' | 'check' | 'people' | 'memo';
  label: string;
  value: string;
  onPress?: () => void;
  action?: { label: string; onPress: () => void };
  divider?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const body = (
    <>
      <UiIcon name={icon} size={22} color={theme.text} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {value}
        </ThemedText>
        {children}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress} style={styles.rowAction}>
          <ThemedText type="smallBold" themeColor="tint">
            {action.label} +
          </ThemedText>
        </Pressable>
      ) : onPress ? (
        <UiIcon name="chevron" size={18} color={theme.textSecondary} />
      ) : null}
    </>
  );
  const style = [styles.ovRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }];
  return onPress && !action ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** 날짜 줄·낚시터 카드의 상태 칩 (특보 · 내 기준 · 예보 전 …) */
function BriefChip({ b }: { b: Brief }) {
  const theme = useTheme();
  const bg =
    b.tone === 'danger'
      ? theme.dangerSoft
      : b.tone === 'success'
        ? theme.tintSoft
        : b.tone === 'warning'
          ? theme.warningSoft
          : theme.background;
  return (
    <View style={[styles.briefChip, { backgroundColor: bg }]}>
      <ThemedText type="smallBold" themeColor={b.tone} numberOfLines={1} style={styles.briefText}>
        {b.text}
      </ThemedText>
    </View>
  );
}

/**
 * 낚시터 카드 (2026-11-24): 이름·역할·시간 + 한 줄 요약(상태 · 파고·바람 · 다음 물때). 「해황 자세히」를 누르면
 * 예전 해황 상자(칩·3칸·물때·만조간조). 고치기·예비로·빼기는 ⋯ 하나로 묶고 기록 버튼만 드러낸다.
 */
function StopCard({
  stop,
  o,
  lastDay,
  criteria,
  today,
  canEdit,
  onEdit,
  onToggleRole,
  onDelete,
}: {
  stop: TripStop;
  o: StopOutlook | undefined;
  lastDay: string | null;
  criteria: ReturnType<typeof useCriteria>[0];
  today: string;
  canEdit: boolean;
  onEdit: () => void;
  onToggleRole: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [more, setMore] = useState(false);
  const time = timeRange(stop);
  const canRecord = stop.day <= today;
  const b = stopBrief(o, criteria, lastDay);
  const next = o?.tides.find((t) => new Date(t.t) > new Date());
  const menu = () =>
    Alert.alert(placeName(stop.place), undefined, [
      { text: '시간·메모 고치기', onPress: onEdit },
      { text: stop.role === 'main' ? '예비 장소로' : '주 장소로', onPress: onToggleRole },
      { text: '이 장소 빼기', style: 'destructive', onPress: onDelete },
      { text: '닫기', style: 'cancel' },
    ]);
  return (
    <View style={[styles.stop, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${placeName(stop.place)} 상세 보기`}
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(stop.place.id) } })}
        style={({ pressed }) => [styles.stopHead, pressed && styles.pressed]}>
        <PlaceThumb place={stop.place} style={styles.stopThumb} />
        <View style={styles.flex}>
          <View style={styles.inline}>
            <View style={[styles.roleTag, { backgroundColor: stop.role === 'main' ? Brand.teal : theme.backgroundSelected }]}>
              <Text style={[styles.roleText, { color: stop.role === 'main' ? '#FFFFFF' : theme.textSecondary }]}>
                {stop.role === 'main' ? '주' : '예비'}
              </Text>
            </View>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
              {placeName(stop.place)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[stop.place.region_name, time].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <UiIcon name="chevron" size={16} color={theme.textSecondary} />
      </Pressable>
      <CoordNote place={stop.place} compact />

      {/* 한 줄 요약: 상태 · 파고·바람 · 다음 물때 → 누르면 자세히 */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => setMore((v) => !v)}
        style={({ pressed }) => [styles.briefRow, pressed && styles.pressed]}>
        <BriefChip b={b} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
          {[b.mini, next ? `${next.type === 'high' ? '만조' : '간조'} ${timeLabel(next.t)}` : null].filter(Boolean).join(' · ') || '해황'}
        </ThemedText>
        <ThemedText type="small" themeColor="tint">
          {more ? '접기' : '자세히'}
        </ThemedText>
      </Pressable>
      {more ? <StopSea o={o} criteria={criteria} lastDay={lastDay} /> : null}
      {stop.memo ? (
        <ThemedText type="small" numberOfLines={2}>
          {stop.memo}
        </ThemedText>
      ) : null}

      <View style={styles.stopActions}>
        {stop.journal_ids.length ? (
          <ActionChip
            icon="book"
            label={stop.journal_ids.length > 1 ? `기록 ${stop.journal_ids.length}개` : '기록 보기'}
            tone="primary"
            onPress={() => router.push({ pathname: '/journal/[id]', params: { id: String(stop.journal_ids[0]) } })}
          />
        ) : canRecord ? (
          <ActionChip
            icon="pencil"
            label="기록 남기기"
            tone="primary"
            onPress={() =>
              router.push({
                pathname: '/journal/new',
                params: { place: String(stop.place.id), date: stop.day, trip_stop: String(stop.id) },
              })
            }
          />
        ) : null}
        {canEdit ? (
          <View style={styles.pushRight}>
            <ActionChip icon="more" label="장소 관리" onPress={menu} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function StopEditor({
  stop,
  onClose,
  onSave,
}: {
  stop: TripStop | null;
  onClose: () => void;
  onSave: (patch: { start_time: string | null; end_time: string | null; memo: string | null }) => void;
}) {
  return (
    <Modal visible={stop !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {stop ? <StopEditorBody key={stop.id} stop={stop} onClose={onClose} onSave={onSave} /> : null}
    </Modal>
  );
}

function StopEditorBody({
  stop,
  onClose,
  onSave,
}: {
  stop: TripStop;
  onClose: () => void;
  onSave: (patch: { start_time: string | null; end_time: string | null; memo: string | null }) => void;
}) {
  const [start, setStart] = useState<Date | null>(hmToDate(stop.start_time));
  const [end, setEnd] = useState<Date | null>(hmToDate(stop.end_time));
  const [memo, setMemo] = useState(stop.memo ?? '');
  const bad = !!start && !!end && toHm(end) < toHm(start);
  return (
    <ThemedView style={styles.sheet}>
      <ThemedText type="sectionTitle">{placeName(stop.place)}</ThemedText>
      <Field label="낚시 시간 (선택)">
        <View style={styles.row}>
          <PickerField mode="time" a11y="시작 시간" value={start} onChange={setStart} placeholder="시작" />
          <ThemedText themeColor="textSecondary">~</ThemedText>
          <PickerField mode="time" a11y="끝 시간" value={end} onChange={setEnd} placeholder="끝" />
          {start || end ? <Chip label="시간 지우기" selected={false} onPress={() => (setStart(null), setEnd(null))} /> : null}
        </View>
        {bad ? (
          <ThemedText type="small" themeColor="danger">
            끝 시간이 시작 시간보다 빨라요.
          </ThemedText>
        ) : null}
      </Field>
      <Field label="메모 (선택)">
        <TextField value={memo} onChangeText={setMemo} placeholder="예: 들물 때 방파제 끝" maxLength={200} multiline />
      </Field>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="취소" variant="secondary" onPress={onClose} />
        </View>
        <View style={styles.flex}>
          <Button
            label="저장"
            disabled={bad}
            onPress={() =>
              onSave({
                start_time: start ? toHm(start) : null,
                end_time: end ? toHm(end) : null,
                memo: memo.trim() || null,
              })
            }
          />
        </View>
      </View>
    </ThemedView>
  );
}

/**
 * 준비물 체크리스트: 누르면 체크(한 개씩 저장 — 여럿이 동시에 눌러도 서로 덮지 않게).
 * 담당: 공용 준비물을 챙길 사람. 만든 사람은 누구든 정하고, 참여자는 자기만 맡거나 내려놓는다.
 * 추가·빼기는 만든 사람만 (목록 전체 저장, 담당은 그대로 둔다)
 */
function Checklist({ trip, run }: { trip: Trip; run: (fn: () => Promise<Trip>) => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [assigning, setAssigning] = useState<ChecklistItem | null>(null);
  const owner = trip.my_role === 'owner';
  const together = trip.members.length > 1;
  const me = trip.members.find((m) => m.mine);
  const items = trip.checklist;
  const plain = (list: ChecklistItem[]) => list.map(({ label, checked, assignee_user_id }) => ({ label, checked, assignee_user_id }));
  const save = (list: ReturnType<typeof plain>) => run(() => api.setTripChecklist(trip.id, list));
  const patch = (c: ChecklistItem, p: Parameters<typeof api.patchChecklistItem>[2]) => run(() => api.patchChecklistItem(trip.id, c.id, p));
  const add = () => {
    const label = text.trim();
    if (!label) return;
    setText('');
    save([...plain(items), { label, checked: false, assignee_user_id: null }]);
  };
  const onAssign = (c: ChecklistItem) => {
    if (owner) return setAssigning(c);
    if (!me) return;
    if (c.assignee_user_id === me.user_id) patch(c, { assignee_user_id: null });
    else if (c.assignee_user_id === null) patch(c, { assignee_user_id: me.user_id });
  };
  return (
    <>
      <Card style={styles.check}>
        {items.length === 0 && !owner ? (
          <ThemedText type="small" themeColor="textSecondary">
            아직 준비물이 없어요. 계획을 만든 사람이 추가할 수 있어요.
          </ThemedText>
        ) : null}
        {items.map((c, i) => {
          const mineItem = !!me && c.assignee_user_id === me.user_id;
          // 참여자가 다른 사람 담당을 바꿀 수는 없다 (보여주기만)
          const canAssign = together && (owner || c.assignee_user_id === null || mineItem);
          const assignLabel = c.assignee_nickname
            ? `담당 ${c.assignee_nickname}${mineItem ? '(나)' : ''}`
            : owner
              ? '담당 정하기'
              : '내가 챙길게';
          return (
            <View key={c.id} style={styles.checkRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: c.checked }}
                onPress={() => patch(c, { checked: !c.checked })}
                style={({ pressed }) => [styles.checkHit, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.box,
                    {
                      borderColor: c.checked ? theme.tint : theme.textSecondary,
                      backgroundColor: c.checked ? theme.tint : 'transparent',
                    },
                  ]}>
                  {c.checked ? <ThemedText style={styles.tick}>✓</ThemedText> : null}
                </View>
                <ThemedText style={[styles.flex, c.checked && styles.done]} themeColor={c.checked ? 'textSecondary' : 'text'}>
                  {c.label}
                </ThemedText>
              </Pressable>
              {together && (canAssign || c.assignee_nickname) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} ${assignLabel}`}
                  disabled={!canAssign}
                  hitSlop={6}
                  onPress={() => onAssign(c)}
                  style={styles.link}>
                  <ThemedText type="small" themeColor={c.assignee_nickname ? 'tint' : 'textSecondary'}>
                    {assignLabel}
                  </ThemedText>
                </Pressable>
              ) : null}
              {owner ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label} 빼기`}
                  hitSlop={8}
                  onPress={() => save(plain(items).filter((_, j) => j !== i))}
                  style={styles.link}>
                  <ThemedText themeColor="textSecondary">✕</ThemedText>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {owner && items.length < 30 ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                value={text}
                onChangeText={setText}
                placeholder="준비물 추가"
                maxLength={40}
                onSubmitEditing={add}
                returnKeyType="done"
              />
            </View>
            <View style={styles.addBtn}>
              <Button label="추가" variant="secondary" onPress={add} />
            </View>
          </View>
        ) : null}
      </Card>
      <OptionSheet
        open={assigning !== null}
        title={assigning ? `「${assigning.label}」 누가 챙길까요?` : ''}
        options={[
          { value: 'none', label: '담당 없음' },
          ...participants(trip).map((m) => ({
            value: String(m.user_id),
            label: m.mine ? `${m.nickname} (나)` : m.nickname,
          })),
        ]}
        value={assigning ? (assigning.assignee_user_id === null ? 'none' : String(assigning.assignee_user_id)) : null}
        onPick={(v) => {
          const c = assigning!;
          setAssigning(null);
          patch(c, { assignee_user_id: v === 'none' ? null : Number(v) });
        }}
        onClose={() => setAssigning(null)}
      />
    </>
  );
}

/** 낚시터 카드의 행동 버튼: 아이콘 + 글자 알약 (2026-11-23, 글자만 있어 버튼인지 몰랐던 것) */
function ActionChip({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: UiIconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger' | 'primary';
}) {
  const theme = useTheme();
  const fg = tone === 'danger' ? theme.danger : tone === 'primary' ? '#FFFFFF' : theme.text;
  const bg = tone === 'primary' ? Brand.orange : tone === 'danger' ? theme.dangerSoft : theme.backgroundElement;
  const border = tone === 'primary' ? Brand.orange : tone === 'danger' ? theme.dangerSoft : theme.border;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.chipBtn, { backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.7 }]}>
      <UiIcon name={icon} size={15} color={fg} />
      <Text style={[styles.chipBtnText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function TripScreen() {
  return (
    <AuthGate message="출조계획은 로그인 후 볼 수 있어요." icon="trips">
      <TripDetail />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 72 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  flip: { transform: [{ rotate: '180deg' }] },
  menuBtn: { padding: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  roleText: { fontSize: 11, fontWeight: '800' },
  briefRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  briefChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  briefText: { fontSize: 12 },
  content: { padding: 16, paddingTop: 0, gap: 12, paddingBottom: 32 },
  hero: { marginHorizontal: -16, paddingHorizontal: 20, paddingBottom: 20, gap: 8, overflow: 'hidden', backgroundColor: Brand.navy },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8, 28, 50, 0.5)' },
  heroSub: { color: Brand.onNavySecondary, fontSize: 14, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 26, lineHeight: 33, fontWeight: '800', letterSpacing: -0.4 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  overview: { paddingVertical: 2, gap: 0 },
  ovRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  rowAction: { minHeight: 36, justifyContent: 'center' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, maxWidth: 220 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: Brand.teal },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  footBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, borderRadius: 12 },
  footPrimary: { backgroundColor: Brand.navy },
  footPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  onNavy: { color: Brand.onNavy },
  dday: { alignSelf: 'flex-start', backgroundColor: Brand.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  ddayText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  day: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dayActions: { flexDirection: 'row', gap: 8 },
  stop: { gap: 8 },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopThumb: { width: 48, height: 48, borderRadius: 10 },
  link: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  chipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 34 },
  chipBtnText: { fontSize: 13, fontWeight: '700' },
  pushRight: { marginLeft: 'auto' },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  sheet: { flex: 1, padding: 20, gap: 14 },
  check: { gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  done: { textDecorationLine: 'line-through' },
});
