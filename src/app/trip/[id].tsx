import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useDateRange, useDeleteTrip, useFavorites, useTrip, useTripMutation, useTripOutlook } from '@/api/queries';
import type { ChecklistItem, StopOutlook, Trip, TripStop } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { PlacePicker } from '@/components/place-picker';
import { Card, ErrorView, Loading, SectionHeader, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel } from '@/lib/compare';
import { criteriaLabel, freshnessLine } from '@/lib/criteria';
import { PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';
import { useCriteria } from '@/lib/prefs';
import { dday, hmToDate, outlookLine, periodLabel, timeRange, toHm, tripDays } from '@/lib/trip';

const MAX_STOPS_PER_DAY = 5;

/** 출조계획 상세 (설계안 §5-3): 날짜별 장소 + 그날 해황 · 두 곳 비교 · 준비물 · 기록 남기기 */
function TripDetail() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const q = useTrip(id);
  const outlook = useTripOutlook(id);
  const range = useDateRange();
  if (q.isPending || !range.data) return <Loading />;
  if (q.isError) return <ErrorView message={q.error.message} onRetry={() => q.refetch()} />;
  return <TripBody trip={q.data} outlook={outlook.data} today={range.data.today} />;
}

function TripBody({
  trip,
  outlook,
  today,
}: {
  trip: Trip;
  outlook: ReturnType<typeof useTripOutlook>['data'];
  today: string;
}) {
  const theme = useTheme();
  const [criteria] = useCriteria();
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<TripStop | null>(null);
  const favorites = useFavorites();
  const del = useDeleteTrip();
  const mutate = useTripMutation((fn: () => Promise<Trip>) => fn());
  const run = (fn: () => Promise<Trip>) => mutate.mutate(fn, { onError: (e) => Alert.alert('저장하지 못했어요', e.message) });
  const byStop = new Map((outlook?.stops ?? []).map((o) => [o.stop_id, o]));

  const confirmDelete = () =>
    Alert.alert('계획을 지울까요?', '이 계획에서 쓴 기록은 지워지지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: () => del.mutate(trip.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <StackScreen>
      <Stack.Screen options={{ title: '출조계획' }} />
      {/* 머리: 제목·기간·D-day */}
      <View style={[styles.head, { backgroundColor: Brand.navy }]}>
        <View style={styles.headTop}>
          <ThemedText type="small" style={styles.onNavySub}>
            나의 출조 계획
          </ThemedText>
          <View style={styles.dday}>
            <ThemedText type="smallBold" style={styles.ddayText}>
              {dday(trip.start_date, trip.end_date, today)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="sectionTitle" style={styles.onNavy}>
          {trip.title}
        </ThemedText>
        <ThemedText type="small" style={styles.onNavySub}>
          {periodLabel(trip.start_date, trip.end_date)}
          {trip.region ? ` · ${trip.region}` : ''}
          {trip.species_name || trip.species_etc ? ` · ${trip.species_name ?? trip.species_etc}` : ''}
        </ThemedText>
        {trip.memo ? (
          <ThemedText type="small" style={styles.onNavy}>
            {trip.memo}
          </ThemedText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/trip/new', params: { id: String(trip.id) } })}
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.onNavy}>
            계획 수정
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        내 기준: {criteriaLabel(criteria)}
        {outlook ? ` · ${freshnessLine(outlook.data_status)}` : ''}
      </ThemedText>

      {/* 날짜별 장소 */}
      {tripDays(trip.start_date, trip.end_date).map((day, i) => {
        const stops = trip.stops.filter((s) => s.day === day);
        const mains = stops.filter((s) => s.role === 'main');
        const pair = stops.length >= 2 ? [mains[0] ?? stops[0], stops.find((s) => s !== (mains[0] ?? stops[0]))!] : null;
        return (
          <View key={day} style={styles.day}>
            <View style={styles.dayHead}>
              <View style={[styles.dayBadge, { backgroundColor: theme.tintSoft }]}>
                <ThemedText type="small" themeColor="tint">
                  DAY {i + 1}
                </ThemedText>
              </View>
              <ThemedText type="sectionTitle">{dayLabel(day)}</ThemedText>
            </View>
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
              {stops.length < MAX_STOPS_PER_DAY ? (
                <SmallButton icon="find-sea" label="장소 추가" onPress={() => setAddingDay(day)} />
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
            {addingDay === day && favorites.data?.length ? (
              <View style={styles.wrap}>
                <ThemedText type="small" themeColor="textSecondary">
                  즐겨찾기에서:
                </ThemedText>
                {favorites.data.slice(0, 5).map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    selected={false}
                    onPress={() => {
                      setAddingDay(null);
                      run(() => api.addTripStop(trip.id, { day, place_id: p.id, role: stops.length ? 'alternative' : 'main' }));
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      <Checklist trip={trip} onSave={(items) => run(() => api.setTripChecklist(trip.id, items))} />

      <ThemedText type="small" themeColor="textSecondary">
        해황은 볼 때마다 최신 공공데이터로 다시 계산해요. 물때는 가까운 조위관측소 예보(참고 자료)예요. 조과를 보장하지 않으며 출조 전
        특보를 꼭 확인하세요.
      </ThemedText>
      <Button label="계획 지우기" variant="danger" onPress={confirmDelete} />

      <PlacePicker
        visible={addingDay !== null}
        title={addingDay ? `${dayLabel(addingDay)}에 넣을 낚시터` : ''}
        onSelect={(p) => {
          const day = addingDay!;
          const has = trip.stops.some((s) => s.day === day);
          setAddingDay(null);
          run(() => api.addTripStop(trip.id, { day, place_id: p.id, role: has ? 'alternative' : 'main' }));
        }}
        onClose={() => setAddingDay(null)}
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
    </StackScreen>
  );
}

function StopCard({
  stop,
  o,
  lastDay,
  criteria,
  today,
  onEdit,
  onToggleRole,
  onDelete,
}: {
  stop: TripStop;
  o: StopOutlook | undefined;
  lastDay: string | null;
  criteria: ReturnType<typeof useCriteria>[0];
  today: string;
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
        <AppIcon name={PLACE_IMAGE[stop.place.type]} size={IconSize.row} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {stop.place.name}{' '}
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
      <View style={[styles.sea, { backgroundColor: theme.background }]}>
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
        <TextAction label="시간·메모" onPress={onEdit} />
        <TextAction label={stop.role === 'main' ? '예비로' : '주 장소로'} onPress={onToggleRole} />
        <TextAction label="빼기" onPress={onDelete} />
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
      <ThemedText type="sectionTitle">{stop.place.name}</ThemedText>
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
              onSave({ start_time: start ? toHm(start) : null, end_time: end ? toHm(end) : null, memo: memo.trim() || null })
            }
          />
        </View>
      </View>
    </ThemedView>
  );
}

/** 준비물 체크리스트: 누르면 체크, ✕ 로 빼기, 아래에서 추가. 바꿀 때마다 목록 전체를 저장 */
function Checklist({ trip, onSave }: { trip: Trip; onSave: (items: { label: string; checked: boolean }[]) => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const items = trip.checklist;
  const plain = (list: ChecklistItem[]) => list.map(({ label, checked }) => ({ label, checked }));
  const add = () => {
    const label = text.trim();
    if (!label) return;
    setText('');
    onSave([...plain(items), { label, checked: false }]);
  };
  return (
    <>
      <SectionHeader title={`준비물 ${items.filter((c) => c.checked).length}/${items.length}`} />
      <Card style={styles.check}>
        {items.map((c, i) => (
          <View key={c.id} style={styles.checkRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: c.checked }}
              onPress={() => onSave(plain(items).map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
              style={({ pressed }) => [styles.checkHit, pressed && styles.pressed]}>
              <View
                style={[
                  styles.box,
                  { borderColor: c.checked ? theme.tint : theme.textSecondary, backgroundColor: c.checked ? theme.tint : 'transparent' },
                ]}>
                {c.checked ? <ThemedText style={styles.tick}>✓</ThemedText> : null}
              </View>
              <ThemedText style={[styles.flex, c.checked && styles.done]} themeColor={c.checked ? 'textSecondary' : 'text'}>
                {c.label}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${c.label} 빼기`}
              hitSlop={8}
              onPress={() => onSave(plain(items).filter((_, j) => j !== i))}
              style={styles.link}>
              <ThemedText themeColor="textSecondary">✕</ThemedText>
            </Pressable>
          </View>
        ))}
        {items.length < 30 ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField value={text} onChangeText={setText} placeholder="준비물 추가" maxLength={40} onSubmitEditing={add} returnKeyType="done" />
            </View>
            <Button label="추가" variant="secondary" onPress={add} />
          </View>
        ) : null}
      </Card>
    </>
  );
}

function SmallButton({ icon, label, onPress }: { icon: 'find-sea' | 'find-compare'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.small, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
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
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  head: { borderRadius: 14, padding: 14, gap: 4 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  onNavy: { color: Brand.onNavy },
  onNavySub: { color: Brand.onNavySecondary },
  dday: { backgroundColor: Brand.orange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  ddayText: { color: '#fff' },
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
  day: { gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  dayActions: { flexDirection: 'row', gap: 8 },
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
  link: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  sea: { borderRadius: 8, padding: 8, gap: 2 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sheet: { flex: 1, padding: 20, gap: 14 },
  check: { gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkHit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  done: { textDecorationLine: 'line-through' },
});
