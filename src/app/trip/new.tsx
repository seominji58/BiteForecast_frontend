import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api';
import { useDateRange, usePlaces, usePlacesSummary, useTrip, useTripMutation } from '@/api/queries';
import type { Trip } from '@/api/types';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, ChipGroup, TextField } from '@/components/form';
import { OptionSheet } from '@/components/option-sheet';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CoordNote } from '@/components/coord-note';
import { LoginRequired } from '@/components/login-required';
import { Loading, StackScreen } from '@/components/screen';
import { NO_SPECIES, SpeciesField, type SpeciesValue } from '@/components/species-field';
import { speciesByCode, toSpeciesValue } from '@/lib/species';
import { ThemedText } from '@/components/themed-text';
import { PlaceField } from '@/components/place-field';
import { formatDay, parseDay } from '@/lib/compare';
import { useAuth } from '@/lib/auth';
import { SEA_GROUPS } from '@/lib/prefs';
import { setTripDraft, type TripDraft, useTripDraft } from '@/lib/trip-draft';
import { periodLabel } from '@/lib/trip';

const MAX_DAYS = 7;

/**
 * 출조계획 만들기 · 수정 (설계안 §5-2). 한 화면 폼.
 * - 로그인 전에도 작성할 수 있다. 「계획 만들기」를 누를 때 로그인을 요청한다
 * - 새 계획은 고칠 때마다 기기에 임시 저장 → 로그인·가입 후, 앱을 껐다 켜도 이어 쓴다 (lib/trip-draft.ts 정책)
 * - ?place=147&date=2026-11-14 : 홈·상세의 「계획에 추가」에서 들어오면 장소·날짜가 채워진다
 * - ?species=rockfish : 홈에서 고른 목표 어종 (기준표에 없는 어종은 기타 입력으로)
 * - ?id=3 : 수정 (로그인 필요, 장소는 계획 화면에서 바꾼다)
 */
function TripFormScreen() {
  const params = useLocalSearchParams<{ place?: string; date?: string; id?: string; species?: string; region?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const { status } = useAuth();
  const { draft, loaded } = useTripDraft();
  const existing = useTrip(editId ?? NaN);
  const range = useDateRange();
  if (editId != null && status !== 'signed-in') {
    return (
      <StackScreen>
        {status === 'loading' ? <Loading /> : <LoginRequired message="출조계획 수정은 로그인 후 할 수 있어요." icon="trips" />}
      </StackScreen>
    );
  }
  if (editId != null && existing.isPending) return <Loading />;
  if (!range.data || (editId == null && !loaded)) return <Loading />;
  // 「계획에 추가」로 새 장소·날짜를 들고 왔으면 그것을, 아니면 작성하던 내용을 이어 쓴다
  const resume = editId == null && !params.place && !params.species && !params.region ? draft : null;
  const fromHome = speciesByCode(params.species);
  return (
    <TripForm
      today={range.data.today}
      initial={editId != null ? existing.data : undefined}
      draft={resume}
      placeId={params.place ? Number(params.place) : null}
      date={params.date ?? null}
      species={fromHome ? toSpeciesValue(fromHome) : null}
      region={params.region && (SEA_GROUPS as readonly string[]).includes(params.region) ? params.region : null}
    />
  );
}

function TripForm({
  today,
  initial,
  draft,
  placeId: initialPlace,
  date,
  species: initialSpecies,
  region: initialRegion,
}: {
  today: string;
  initial?: Trip;
  draft: TripDraft | null;
  placeId: number | null;
  date: string | null;
  species?: SpeciesValue | null;
  region?: string | null;
}) {
  const places = usePlaces();
  const summary = usePlacesSummary(today);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { signedIn } = useAuth();
  const startDefault = initial?.start_date ?? (date && date >= today ? date : today);
  // 작성본의 날짜가 이미 지났으면 오늘로 (지난 날짜로 새 계획을 만들지 않게)
  const d = draft && draft.start >= today ? draft : draft ? { ...draft, start: today, end: today } : null;
  const [title, setTitle] = useState(initial?.title ?? d?.title ?? '');
  const [start, setStart] = useState(d?.start ?? startDefault);
  const [end, setEnd] = useState(initial?.end_date ?? d?.end ?? startDefault);
  const [region, setRegion] = useState<string | null>(initial?.region ?? d?.region ?? initialRegion ?? null);
  const [species, setSpecies] = useState<SpeciesValue>(
    initial ? { code: initial.species_code, etc: initial.species_etc } : (initialSpecies ?? d?.species ?? NO_SPECIES),
  );
  const [memo, setMemo] = useState(initial?.memo ?? d?.memo ?? '');
  const [placeId, setPlaceId] = useState<number | null>(initial ? null : (d?.placeId ?? initialPlace));
  const [error, setError] = useState<string | null>(null);
  // 새 계획: 사용자가 무언가 바꾸면 기기에 임시 저장 (수정 화면은 저장하지 않음)
  const [dirty, setDirty] = useState(false);
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };
  useEffect(() => {
    if (!initial && dirty) setTripDraft({ title, start, end, region, species, memo, placeId });
  }, [initial, dirty, title, start, end, region, species, memo, placeId]);

  const save = useTripMutation((v: { id: number | null }) => {
    const body = {
      title: title.trim() || null,
      start_date: start,
      end_date: end,
      region,
      species_code: species.code,
      species_etc: species.etc,
      memo: memo.trim() || null,
    };
    return v.id != null
      ? api.updateTrip(v.id, body)
      : api.createTrip({ ...body, stops: placeId ? [{ day: start, place_id: placeId }] : [] });
  });

  const maxEnd = formatDay(new Date(parseDay(start).getTime() + (MAX_DAYS - 1) * 86_400_000));
  const setStartDay = (d: string) => {
    setStart(d);
    if (end < d || end > formatDay(new Date(parseDay(d).getTime() + (MAX_DAYS - 1) * 86_400_000))) setEnd(d);
  };
  const place = places.data?.find((p) => p.id === placeId);
  const autoTitle = `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))} ${region ?? place?.region_name.split(' ').at(-1) ?? ''} 출조`.replace('  ', ' ');

  const submit = () => {
    setError(null);
    if (!signedIn) {
      // 저장하려는 순간 로그인 요청. 작성 내용은 앱 메모리에 남겨 로그인·가입 후 이어 쓴다
      setTripDraft({ title, start, end, region, species, memo, placeId });
      router.push({ pathname: '/login', params: { reason: 'trip' } });
      return;
    }
    save.mutate(
      { id: initial?.id ?? null },
      {
        onSuccess: (t) => {
          if (!initial) setTripDraft(null);
          if (initial) router.back();
          else {
            router.replace({ pathname: '/trip/[id]', params: { id: String(t.id) } });
            // 새 계획을 만든 직후가 친구를 부르기 가장 좋은 때 — 초대 코드는 계획 › 동행에서 만든다
            Alert.alert('계획을 만들었어요', '같이 갈 친구가 있으면 초대 코드를 보내 보세요.', [
              { text: '나중에', style: 'cancel' },
              { text: '친구 초대', onPress: () => router.replace({ pathname: '/trip/[id]', params: { id: String(t.id), tab: 'members' } }) },
            ]);
          }
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const [sheet, setSheet] = useState<'date' | 'region' | null>(null);
  const addDays = (v: string, n: number) => formatDay(new Date(parseDay(v).getTime() + n * 86_400_000));
  const sat = addDays(today, (6 - parseDay(today).getDay() + 7) % 7);
  const quick = [
    { key: today, label: '오늘' },
    { key: addDays(today, 1), label: '내일' },
    ...(sat !== today && sat !== addDays(today, 1) ? [{ key: sat, label: '이번 토요일' }] : []),
  ];
  // 낚시터를 고르면 그 바다로 지역을 채운다 (지역을 직접 골랐으면 그대로)
  const [regionAuto, setRegionAuto] = useState(false);
  const pickPlace = (id: number | null) => {
    touch(setPlaceId)(id);
    const sea = id ? summary.data?.places.find((x) => x.place_id === id)?.sea_group : null;
    if (sea && (region == null || regionAuto)) {
      setRegion(sea);
      setRegionAuto(true);
    }
  };
  const cancel = () =>
    Alert.alert('작성을 취소할까요?', '이 기기에 임시 저장한 내용도 지워져요.', [
      { text: '계속 작성', style: 'cancel' },
      {
        text: '취소하고 나가기',
        style: 'destructive',
        onPress: () => {
          setTripDraft(null);
          router.back();
        },
      },
    ]);

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          title: initial ? '출조계획 수정' : '새 출조계획',
          headerRight:
            !initial && (d || dirty)
              ? () => (
                  <Pressable accessibilityRole="button" onPress={cancel} hitSlop={12}>
                    <Text style={styles.headerAction}>작성 취소</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {d && !initial && signedIn ? (
            <ThemedText type="small" themeColor="tint">
              작성하던 내용을 불러왔어요. 「계획 저장」을 누르면 계정에 저장돼요.
            </ThemedText>
          ) : null}
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <FormRow icon="title" label="계획 제목">
              <TextField value={title} onChangeText={touch(setTitle)} placeholder={`예) ${autoTitle}`} maxLength={60} returnKeyType="done" />
            </FormRow>
            <FormRow
              icon="calendar"
              label="출조 날짜"
              required
              value={periodLabel(start, end)}
              onPress={() => setSheet('date')}
              divider
            />
            <FormRow
              icon="pin"
              label="지역"
              value={region}
              placeholder="지역 선택"
              hint={regionAuto && region ? '낚시터 위치로 골랐어요' : null}
              onPress={() => setSheet('region')}
              divider
            />
            <SpeciesField
              value={species}
              onChange={touch(setSpecies)}
              trigger={(open, name) => (
                <FormRow icon="fish" label="목표 어종" value={name} placeholder="어종 선택" onPress={open} divider />
              )}
            />
            {!initial ? (
              <PlaceField
                value={placeId}
                onChange={pickPlace}
                trigger={(open, p) => (
                  <FormRow
                    icon="place"
                    label="출조 장소"
                    value={p ? `${p.name} · ${p.region_name}` : null}
                    action={p ? undefined : '낚시터 추가'}
                    onPress={open}
                    onClear={p ? () => pickPlace(null) : undefined}
                    hint={p ? `첫날(${start.slice(5).replace('-', '/')})에 넣어요` : null}
                    divider
                  />
                )}
              />
            ) : null}
            {!initial ? (
              <FormRow icon="check" label="준비물" value="기본 4가지" hint="저장한 뒤 계획 화면에서 고치거나 더해요" divider />
            ) : null}
            <FormRow icon="memo" label="메모" divider>
              <TextField
                value={memo}
                onChangeText={touch(setMemo)}
                placeholder="필요한 내용을 자유롭게 입력하세요. (선택)"
                multiline
                maxLength={1000}
              />
            </FormRow>
          </View>
          {place ? <CoordNote place={place} compact /> : null}
          {place?.location_suspect ? (
            <ThemedText type="small" themeColor="warning">
              위치가 확인되지 않은 낚시터예요. 계획에는 넣을 수 있지만 지도·거리·해황은 보여드리지 않아요.
            </ThemedText>
          ) : null}
          {!initial ? (
            <ThemedText type="caption" themeColor="textSecondary">
              작성 중인 내용은 이 기기에 임시 저장돼요. 계정에 저장하거나 「작성 취소」를 누르면 지워지고, 7일이 지나거나 날짜가 지나면
              자동으로 지워져요.
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <Button
            label={save.isPending ? '저장 중…' : initial ? '수정 저장' : signedIn ? '계획 저장' : '로그인하고 계획 저장'}
            disabled={save.isPending}
            onPress={submit}
          />
          {!initial && !signedIn ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
              로그인해도 작성한 내용은 그대로 남아 있어요
            </ThemedText>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {/* 날짜 고르기 시트: 빠른 선택 + 시작~끝 */}
      <Modal visible={sheet === 'date'} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
          <ThemedText type="sectionTitle">출조 날짜</ThemedText>
          {!initial ? (
            <ChipGroup>
              {quick.map((q) => (
                <Chip
                  key={q.key}
                  label={q.label}
                  selected={start === q.key && end === q.key}
                  onPress={() => {
                    touch(setStart)(q.key);
                    setEnd(q.key);
                  }}
                />
              ))}
            </ChipGroup>
          ) : null}
          <View style={styles.row}>
            <PickerField
              mode="date"
              a11y="시작 날짜"
              value={parseDay(start)}
              minimumDate={initial ? undefined : parseDay(today)}
              onChange={(v) => touch(setStartDay)(formatDay(v))}
            />
            <ThemedText themeColor="textSecondary">~</ThemedText>
            <PickerField
              mode="date"
              a11y="끝 날짜"
              value={parseDay(end)}
              minimumDate={parseDay(start)}
              maximumDate={parseDay(maxEnd)}
              onChange={(v) => touch(setEnd)(formatDay(v))}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {periodLabel(start, end)} · 최대 {MAX_DAYS}일. 예보가 아직 없는 날짜도 저장할 수 있어요.
          </ThemedText>
          <Button label="완료" onPress={() => setSheet(null)} />
        </View>
      </Modal>
      <OptionSheet
        open={sheet === 'region'}
        title="지역"
        value={region ?? 'none'}
        options={[{ value: 'none', label: '정하지 않음' }, ...SEA_GROUPS.map((g) => ({ value: g as string, label: g }))]}
        onPick={(v) => {
          touch(setRegion)(v === 'none' ? null : v);
          setRegionAuto(false);
        }}
        onClose={() => setSheet(null)}
      />
    </ThemedView>
  );
}

/** 레퍼런스 폼 한 줄: 아이콘 · 항목 이름(*) · 오른쪽 값 ›  (또는 아래에 입력칸) */
function FormRow({
  icon,
  label,
  required,
  value,
  placeholder,
  action,
  hint,
  onPress,
  onClear,
  divider,
  children,
}: {
  icon: 'title' | 'calendar' | 'pin' | 'fish' | 'place' | 'check' | 'memo';
  label: string;
  required?: boolean;
  value?: string | null;
  placeholder?: string;
  /** 값이 없을 때 오른쪽 틸 글자 (예: 낚시터 추가 +) */
  action?: string;
  hint?: string | null;
  onPress?: () => void;
  onClear?: () => void;
  divider?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const iconName = icon === 'place' ? 'map' : icon;
  const head = (
    <View style={styles.rowHead}>
      <UiIcon name={iconName} size={22} color={theme.text} />
      <ThemedText type="smallBold" style={children ? styles.flex : undefined}>
        {label}
        {required ? <ThemedText type="smallBold" style={{ color: Brand.orange }}> *</ThemedText> : null}
      </ThemedText>
      {children ? null : (
        <View style={styles.rowRight}>
          {action ? (
            <ThemedText type="smallBold" themeColor="tint">
              {action} +
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.rowValue}>
              {value ?? placeholder ?? ''}
            </ThemedText>
          )}
          {onClear ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${label} 비우기`} hitSlop={10} onPress={onClear}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ✕
              </ThemedText>
            </Pressable>
          ) : null}
          {onPress && !action ? <UiIcon name="chevron" size={18} color={theme.textSecondary} /> : null}
        </View>
      )}
    </View>
  );
  const body = (
    <>
      {head}
      {children ? <View style={styles.rowInput}>{children}</View> : null}
      {hint ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.rowHint}>
          {hint}
        </ThemedText>
      ) : null}
    </>
  );
  const style = [styles.formRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${required ? ' 필수' : ''}, ${value ?? placeholder ?? action ?? ''}`}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

export default function NewTripScreen() {
  return <TripFormScreen />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  formRow: { paddingVertical: 14, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  rowRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  rowInput: { paddingLeft: 34 },
  rowHint: { paddingLeft: 34, marginTop: -4 },
  headerAction: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 16, gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,20,40,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14 },
});
