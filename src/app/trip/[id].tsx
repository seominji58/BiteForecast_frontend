import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { useDateRange, useDeleteTrip, useFavorites, useTrip, useTripMutation, useTripOutlook } from '@/api/queries';
import type { ChecklistItem, StopOutlook, Trip, TripStop } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { CoordNote } from '@/components/coord-note';
import { OptionSheet } from '@/components/option-sheet';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { PlacePicker } from '@/components/place-picker';
import { Card, ErrorView, Loading, SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { CatchStrip } from '@/components/catch-strip';
import { ownerName, participants, TripMembers } from '@/components/trip-members';
import { PlaceThumb } from '@/components/place-photo';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/compare';
import { criteriaLabel, freshnessLine } from '@/lib/criteria';
import { PLACE_TYPE_LABEL, placeName, sidoOf } from '@/lib/place';
import { useCriteria } from '@/lib/prefs';
import { speciesForRecord } from '@/lib/species';
import { dday, hmToDate, outlookLine, periodLabel, timeRange, toHm, tripDays } from '@/lib/trip';

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
  const [openDays, setOpenDays] = useState<Set<string>>(
    () => new Set(days.length <= 2 ? days : [days.find((d) => d >= today) ?? days[0]]),
  );
  // 한 화면에 모든 것을 늘어놓지 않게 탭으로 나눈다: 장소 · 함께 · 준비물
  // ?tab=members 로 열면 동행 탭부터 (계획을 만든 직후 「친구 초대」)
  const [tab, setTab] = useState<'overview' | 'plan' | 'members' | 'checklist'>(() =>
    initialTab === 'members' || initialTab === 'plan' || initialTab === 'checklist' ? initialTab : 'overview',
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [scrolled, setScrolled] = useState(false);
  const allOpen = openDays.size === days.length;
  const [editing, setEditing] = useState<TripStop | null>(null);
  const favorites = useFavorites();
  const del = useDeleteTrip();
  const mutate = useTripMutation((fn: () => Promise<Trip>) => fn());
  const run = (fn: () => Promise<Trip>) =>
    mutate.mutate(fn, { onError: (e) => Alert.alert('저장하지 못했어요', e.message) });
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

  // 개요에 보여줄 대표 장소: 날짜순 → 주 장소 먼저
  const ordered = [...trip.stops].sort((x, y) =>
    x.day === y.day ? (x.role === y.role ? x.sort_order - y.sort_order : x.role === 'main' ? -1 : 1) : x.day.localeCompare(y.day),
  );
  const firstStop = ordered[0] ?? null;
  const done = trip.checklist.filter((c) => c.checked).length;
  const people = participants(trip).length;
  const recordStop = ordered.find((s) => s.day <= today) ?? null;
  const writeRecord = () => {
    if (recordStop)
      router.push({ pathname: '/journal/new', params: { place: String(recordStop.place.id), date: recordStop.day, trip_stop: String(recordStop.id) } });
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
          headerRight: owner
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="계획 수정"
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/trip/new', params: { id: String(trip.id) } })}>
                  <UiIcon name="edit" size={22} color="#FFFFFF" />
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

        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {(
            [
              ['overview', '개요'],
              ['plan', '장소·예보'],
              ['checklist', '준비물'],
              ['members', '동행'],
            ] as const
          ).map(([key, label]) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTab(key)}
                style={[styles.tab, on && { backgroundColor: Brand.navy }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={on ? styles.onNavy : undefined} numberOfLines={1}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {tab === 'overview' ? (
          <>
            <Card style={styles.overview}>
              <OverviewRow
                icon="pin"
                label="출조 장소"
                value={firstStop ? `${firstStop.place.name}${trip.stops.length > 1 ? ` 외 ${trip.stops.length - 1}곳` : ''}` : '장소 미정'}
                onPress={firstStop ? () => setTab('plan') : undefined}
                action={
                  owner && !firstStop
                    ? { label: '낚시터 추가', onPress: () => setPickingDay(days.find((d) => d >= today) ?? days[0]) }
                    : undefined
                }
              />
              <OverviewRow icon="check" label="준비물" value={`${done}/${trip.checklist.length}`} onPress={() => setTab('checklist')} divider>
                <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
                  <View style={[styles.barFill, { width: `${trip.checklist.length ? (done / trip.checklist.length) * 100 : 0}%` }]} />
                </View>
              </OverviewRow>
              <OverviewRow
                icon="people"
                label="동행"
                value={trip.my_role === 'owner' ? `${people}명 · 친구 초대` : `${people}명`}
                onPress={() => setTab('members')}
                divider
              />
              {trip.memo ? <OverviewRow icon="memo" label="메모" value={trip.memo} divider /> : null}
            </Card>

            <View style={styles.seaHead}>
              <ThemedText type="sectionTitle" style={styles.flex}>
                해황 예보{firstStop ? ` (${dayLabel(firstStop.day).split(' ')[0]})` : ''}
              </ThemedText>
              {outlook?.data_status.forecast_issued_at ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatIssued(outlook.data_status.forecast_issued_at)} 발표
                </ThemedText>
              ) : null}
            </View>
            {firstStop ? (
              <SeaTiles stop={firstStop} o={byStop.get(firstStop.id)} lastDay={outlook?.forecast_last_day ?? null} criteria={criteria} />
            ) : (
              <Card>
                <ThemedText type="small" themeColor="textSecondary">
                  낚시터를 추가하면 그날 파고·풍속·물때·특보를 보여드려요.
                </ThemedText>
              </Card>
            )}
            <ThemedText type="caption" themeColor="textSecondary">
              {outlook ? `${freshnessLine(outlook.data_status)} · ` : ''}해황·물때는 참고 자료예요. 출조 전 특보를 꼭 확인하세요.
            </ThemedText>
          </>
        ) : null}

        {tab === 'plan' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              내 기준: {criteriaLabel(criteria)}
            </ThemedText>
          {/* 날짜별 장소 — 날짜마다 접기·펼치기 (7일 × 5곳이어도 화면이 길어지지 않게) */}
          {days.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenDays(allOpen ? new Set() : new Set(days))}
              style={styles.toggleAll}>
              <ThemedText type="small" themeColor="tint">
                {allOpen ? '모두 접기' : '모두 펼치기'}
              </ThemedText>
            </Pressable>
          ) : null}
          {days.map((day, i) => {
            // 주 장소 먼저, 그다음 예비 (각각 정한 순서대로)
            const stops = trip.stops
              .filter((s) => s.day === day)
              .sort((x, y) => (x.role === y.role ? x.sort_order - y.sort_order : x.role === 'main' ? -1 : 1));
            const mains = stops.filter((s) => s.role === 'main');
            const alts = stops.filter((s) => s.role !== 'main');
            const pair = stops.length >= 2 ? [stops[0], stops[1]] : null;
            const open = openDays.has(day);
            const summary = stops.length
              ? [
                  mains.length ? `주 ${mains.map((s) => s.place.name).join('·')}` : '주 장소 없음',
                  alts.length ? `예비 ${alts.length}곳` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '장소 없음';
            return (
              <View
                key={day}
                style={[styles.day, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${dayLabel(day)}, ${summary}, ${open ? '접기' : '펼치기'}`}
                  onPress={() => {
                    const next = new Set(openDays);
                    if (open) next.delete(day);
                    else next.add(day);
                    setOpenDays(next);
                  }}
                  style={({ pressed }) => [styles.dayHead, pressed && styles.pressed]}>
                  <View style={[styles.dayBadge, { backgroundColor: theme.tintSoft }]}>
                    <ThemedText type="small" themeColor="tint">
                      DAY {i + 1}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">
                      {dayLabel(day)}
                      {day < today ? ' · 지남' : day === today ? ' · 오늘' : ''}
                    </ThemedText>
                    {!open ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {summary}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText themeColor="textSecondary">{open ? '▲' : '▼'}</ThemedText>
                </Pressable>
                {open ? (
                  <View style={styles.dayBody}>
                    {stops.length === 0 ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        아직 고른 낚시터가 없어요.
                      </ThemedText>
                    ) : null}
                    {[
                      ['주 장소', mains],
                      ['예비 장소', alts],
                    ].map(([label, list]) =>
                      (list as TripStop[]).length ? (
                        <View key={label as string} style={styles.group}>
                          <ThemedText
                            type="small"
                            themeColor={label === '주 장소' ? 'tint' : 'textSecondary'}
                            style={styles.groupLabel}>
                            {label as string}
                          </ThemedText>
                          {(list as TripStop[]).map((s) => (
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
                                run(() =>
                                  api.updateTripStop(trip.id, s.id, {
                                    role: s.role === 'main' ? 'alternative' : 'main',
                                  }),
                                )
                              }
                              onDelete={() =>
                                Alert.alert(`${s.place.name}을(를) 뺄까요?`, undefined, [
                                  { text: '취소', style: 'cancel' },
                                  {
                                    text: '빼기',
                                    style: 'destructive',
                                    onPress: () => run(() => api.deleteTripStop(trip.id, s.id)),
                                  },
                                ])
                              }
                            />
                          ))}
                        </View>
                      ) : null,
                    )}
                    <View style={styles.dayActions}>
                      {owner && stops.length < MAX_STOPS_PER_DAY ? (
                        <SmallButton
                          icon="find-sea"
                          label="장소 추가"
                          onPress={() => setAddingDay(addingDay === day ? null : day)}
                        />
                      ) : null}
                      {pair ? (
                        <SmallButton
                          icon="find-compare"
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
                              run(() =>
                                api.addTripStop(trip.id, {
                                  day,
                                  place_id: p.id,
                                  role: stops.length ? 'alternative' : 'main',
                                }),
                              );
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
          })}

          {/* 출조 전 참고: 첫 장소 시·도와 목표 어종의 최근 이용자 조황 (예보와 구분, 없으면 숨김) */}
          {trip.stops[0] ? (
            <CatchStrip
              title={`${sidoOf(trip.stops[0].place)} 최근 이용자 조황`}
              filter={{
                sido: sidoOf(trip.stops[0].place),
                species: speciesForRecord(trip.species_code, trip.species_etc)
                  ? (trip.species_code ?? trip.species_etc)
                  : null,
              }}
              note="이용자가 올린 조황이에요. 예보가 아니에요."
            />
          ) : null}

          </>
        ) : null}

        {tab === 'members' ? <TripMembers trip={trip} run={run} /> : null}

        {tab === 'checklist' ? <Checklist trip={trip} run={run} /> : null}

        {owner && (tab === 'overview' || tab === 'plan') ? (
          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteBtn, { backgroundColor: theme.danger }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.onNavy}>
              계획 지우기
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* 아래 고정: 계획 수정 · 기록 작성 */}
      <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          style={({ pressed }) => [styles.footBtn, { borderColor: Brand.navy, borderWidth: 1.5, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
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
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value}`} onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** 해황 4칸 (파고 · 풍속 · 물때 · 특보). 값이 없으면 「발표 전」·「자료 없음」 — 만들지 않는다 */
function SeaTiles({
  stop,
  o,
  lastDay,
  criteria,
}: {
  stop: TripStop;
  o: StopOutlook | undefined;
  lastDay: string | null;
  criteria: ReturnType<typeof useCriteria>[0];
}) {
  const theme = useTheme();
  const line = outlookLine(o, criteria, lastDay);
  const ok = o?.forecast_status === 'available';
  const pending = o?.forecast_status === 'pending';
  const val = (v: { v: number } | null | undefined, unit: string) => (ok ? (v ? `${v.v}${unit}` : '자료 없음') : pending ? '발표 전' : '–');
  const warn = !o
    ? { text: '확인 중', tone: 'textSecondary' as const }
    : o.warning_level == null || o.warning_level === 'unknown'
      ? { text: '확인 불가', tone: 'warning' as const }
      : !o.warning_is_current
        ? { text: '발표 전', tone: 'textSecondary' as const }
        : o.warning_level === 'warning'
          ? { text: '특보 발효', tone: 'danger' as const }
          : o.warning_level === 'none'
            ? { text: '특보 없음', tone: 'success' as const }
            : { text: '인근 특보', tone: 'warning' as const };
  const tiles = [
    { icon: 'wave' as const, label: '파고', value: val(o?.wave_fc_max, 'm') },
    { icon: 'wind' as const, label: '풍속', value: val(o?.wind_fc_max, 'm/s') },
    { icon: 'moon' as const, label: '물때', value: o?.mulddae ?? '–' },
  ];
  return (
    <Card style={styles.sea}>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {placeName(stop.place)} · {dayLabel(stop.day)}
      </ThemedText>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <UiIcon name={t.icon} size={20} color={Brand.teal} />
            <ThemedText type="caption" themeColor="textSecondary">
              {t.label}
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </ThemedText>
          </View>
        ))}
        <View style={[styles.warnPill, { backgroundColor: warn.tone === 'danger' ? theme.dangerSoft : warn.tone === 'success' ? theme.tintSoft : theme.warningSoft }]}>
          <ThemedText type="smallBold" themeColor={warn.tone} style={styles.center}>
            {warn.text}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="caption" themeColor={line.tone} numberOfLines={2}>
        {line.text}
        {line.fit ? ` · ${line.fit.label}` : ''}
      </ThemedText>
    </Card>
  );
}

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
  const line = outlookLine(o, criteria, lastDay);
  const time = timeRange(stop);
  const canRecord = stop.day <= today;
  return (
    <Card style={styles.stop}>
      <View style={styles.stopHead}>
        <PlaceThumb place={stop.place} style={styles.stopThumb} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {placeName(stop.place)}{' '}
            <ThemedText type="small" themeColor={stop.role === 'main' ? 'tint' : 'textSecondary'}>
              {stop.role === 'main' ? '주 장소' : '예비'}
            </ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[stop.place.region_name, PLACE_TYPE_LABEL[stop.place.type], time].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(stop.place.id) } })}
          style={styles.link}>
          <ThemedText type="small" themeColor="tint">
            상세 ›
          </ThemedText>
        </Pressable>
      </View>
      <CoordNote place={stop.place} compact />
      <View style={[styles.stopSea, { backgroundColor: theme.background }]}>
        <ThemedText type="small" themeColor={line.tone}>
          {line.text}
        </ThemedText>
        {line.fit ? (
          <ThemedText type="smallBold" themeColor={line.fit.color}>
            {line.fit.label}
          </ThemedText>
        ) : null}
        {line.tide ? (
          <ThemedText type="small" themeColor="textSecondary">
            {line.tide}
          </ThemedText>
        ) : null}
      </View>
      {stop.memo ? <ThemedText type="small">{stop.memo}</ThemedText> : null}
      <View style={styles.stopActions}>
        {canEdit ? (
          <>
            <TextAction label="시간·메모" onPress={onEdit} />
            <TextAction label={stop.role === 'main' ? '예비로' : '주 장소로'} onPress={onToggleRole} />
            <TextAction label="빼기" onPress={onDelete} />
          </>
        ) : null}
        <View style={styles.flex} />
        {stop.journal_ids.length ? (
          <TextAction
            label={`기록 ${stop.journal_ids.length}개 ›`}
            strong
            onPress={() => router.push({ pathname: '/journal/[id]', params: { id: String(stop.journal_ids[0]) } })}
          />
        ) : canRecord ? (
          <TextAction
            label="기록 남기기 ›"
            strong
            onPress={() =>
              router.push({
                pathname: '/journal/new',
                params: { place: String(stop.place.id), date: stop.day, trip_stop: String(stop.id) },
              })
            }
          />
        ) : null}
      </View>
    </Card>
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
          {start || end ? (
            <Chip label="시간 지우기" selected={false} onPress={() => (setStart(null), setEnd(null))} />
          ) : null}
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
  const plain = (list: ChecklistItem[]) =>
    list.map(({ label, checked, assignee_user_id }) => ({ label, checked, assignee_user_id }));
  const save = (list: ReturnType<typeof plain>) => run(() => api.setTripChecklist(trip.id, list));
  const patch = (c: ChecklistItem, p: Parameters<typeof api.patchChecklistItem>[2]) =>
    run(() => api.patchChecklistItem(trip.id, c.id, p));
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
      <SectionHeader title={`준비물 ${items.filter((c) => c.checked).length}/${items.length}`} />
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
                <ThemedText
                  style={[styles.flex, c.checked && styles.done]}
                  themeColor={c.checked ? 'textSecondary' : 'text'}>
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
            <Button label="추가" variant="secondary" onPress={add} />
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

function SmallButton({
  icon,
  label,
  onPress,
}: {
  icon: 'find-sea' | 'find-compare';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.small,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <AppIcon name={icon} size={18} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function TextAction({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={onPress} style={styles.link}>
      <ThemedText type={strong ? 'smallBold' : 'small'} themeColor={strong ? 'tint' : 'textSecondary'}>
        {label}
      </ThemedText>
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
  content: { padding: 16, paddingTop: 0, gap: 12, paddingBottom: 32 },
  center: { textAlign: 'center' },
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
  seaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tile: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  warnPill: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  footBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, borderRadius: 12 },
  footPrimary: { backgroundColor: Brand.navy },
  footPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speciesArt: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  head: { borderRadius: 14, padding: 14, gap: 4 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onNavy: { color: Brand.onNavy },
  onNavySub: { color: Brand.onNavySecondary },
  dday: { alignSelf: 'flex-start', backgroundColor: Brand.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  ddayText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
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
  group: { gap: 6 },
  groupLabel: { fontWeight: '700' },
  toggleAll: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  dayBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dayActions: { flexDirection: 'row', gap: 8 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4, marginTop: -4 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  deleteBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  deleteLink: { alignSelf: 'center', paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
  },
  stop: { gap: 8 },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopThumb: { width: 48, height: 48, borderRadius: 10 },
  link: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  sea: { gap: 10 },
  stopSea: { borderRadius: 8, padding: 8, gap: 2 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sheet: { flex: 1, padding: 20, gap: 14 },
  check: { gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  done: { textDecorationLine: 'line-through' },
});
