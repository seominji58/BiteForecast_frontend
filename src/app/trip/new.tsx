import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useDateRange, usePlaces, useTrip, useTripMutation } from '@/api/queries';
import type { Trip } from '@/api/types';
import { PickerField } from '@/components/date-time-field';
import { Button, Chip, ChipGroup, Field, TextField } from '@/components/form';
import { CoordNote } from '@/components/coord-note';
import { LoginRequired } from '@/components/login-required';
import { Loading, StackScreen } from '@/components/screen';
import { NO_SPECIES, SpeciesField, type SpeciesValue } from '@/components/species-field';
import { ThemedText } from '@/components/themed-text';
import { PlaceField } from '@/components/place-field';
import { formatDay, parseDay } from '@/lib/compare';
import { useAuth } from '@/lib/auth';
import { SEA_GROUPS } from '@/lib/prefs';
import { setTripDraft, type TripDraft, useTripDraft } from '@/lib/trip-draft';
import { DEFAULT_CHECKLIST_HINT, periodLabel } from '@/lib/trip';

const MAX_DAYS = 7;

/**
 * 출조계획 만들기 · 수정 (설계안 §5-2). 한 화면 폼.
 * - 로그인 전에도 작성할 수 있다. 「계획 만들기」를 누를 때 로그인을 요청한다
 * - 새 계획은 고칠 때마다 기기에 임시 저장 → 로그인·가입 후, 앱을 껐다 켜도 이어 쓴다 (lib/trip-draft.ts 정책)
 * - ?place=147&date=2026-11-14 : 홈·상세의 「계획에 추가」에서 들어오면 장소·날짜가 채워진다
 * - ?id=3 : 수정 (로그인 필요, 장소는 계획 화면에서 바꾼다)
 */
function TripFormScreen() {
  const params = useLocalSearchParams<{ place?: string; date?: string; id?: string }>();
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
  const resume = editId == null && !params.place ? draft : null;
  return (
    <TripForm
      today={range.data.today}
      initial={editId != null ? existing.data : undefined}
      draft={resume}
      placeId={params.place ? Number(params.place) : null}
      date={params.date ?? null}
    />
  );
}

function TripForm({
  today,
  initial,
  draft,
  placeId: initialPlace,
  date,
}: {
  today: string;
  initial?: Trip;
  draft: TripDraft | null;
  placeId: number | null;
  date: string | null;
}) {
  const places = usePlaces();
  const { signedIn } = useAuth();
  const startDefault = initial?.start_date ?? (date && date >= today ? date : today);
  // 작성본의 날짜가 이미 지났으면 오늘로 (지난 날짜로 새 계획을 만들지 않게)
  const d = draft && draft.start >= today ? draft : draft ? { ...draft, start: today, end: today } : null;
  const [title, setTitle] = useState(initial?.title ?? d?.title ?? '');
  const [start, setStart] = useState(d?.start ?? startDefault);
  const [end, setEnd] = useState(initial?.end_date ?? d?.end ?? startDefault);
  const [region, setRegion] = useState<string | null>(initial?.region ?? d?.region ?? null);
  const [species, setSpecies] = useState<SpeciesValue>(
    initial ? { code: initial.species_code, etc: initial.species_etc } : (d?.species ?? NO_SPECIES),
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
      router.push('/login');
      return;
    }
    save.mutate(
      { id: initial?.id ?? null },
      {
        onSuccess: (t) => {
          if (!initial) setTripDraft(null);
          if (initial) router.back();
          else router.replace({ pathname: '/trip/[id]', params: { id: String(t.id) } });
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: initial ? '출조계획 수정' : '새 출조계획' }} />
      <Field label="날짜" required>
        <View style={styles.row}>
          <PickerField
            mode="date"
            a11y="시작 날짜"
            value={parseDay(start)}
            minimumDate={initial ? undefined : parseDay(today)}
            onChange={(d) => touch(setStartDay)(formatDay(d))}
          />
          <ThemedText themeColor="textSecondary">~</ThemedText>
          <PickerField
            mode="date"
            a11y="끝 날짜"
            value={parseDay(end)}
            minimumDate={parseDay(start)}
            maximumDate={parseDay(maxEnd)}
            onChange={(d) => touch(setEnd)(formatDay(d))}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {periodLabel(start, end)} · 최대 {MAX_DAYS}일. 예보가 아직 없는 날짜도 저장할 수 있어요.
        </ThemedText>
      </Field>

      {!initial ? (
        <Field label="첫 낚시터 (선택)">
          <PlaceField value={placeId} onChange={touch(setPlaceId)} placeholder="낚시터 고르기 — 나중에 추가해도 돼요" />
          {place ? <CoordNote place={place} compact /> : null}
          {place?.location_suspect ? (
            <ThemedText type="small" themeColor="warning">
              위치가 확인되지 않은 낚시터예요. 계획에는 넣을 수 있지만 지도·거리·해황은 보여드리지 않아요.
            </ThemedText>
          ) : null}
          {placeId ? (
            <ThemedText type="small" themeColor="textSecondary">
              첫날({start.slice(5).replace('-', '/')})에 넣어요. 다른 날 장소는 계획 화면에서 추가하세요.
            </ThemedText>
          ) : null}
        </Field>
      ) : null}

      <Field label="지역 (선택)">
        <ChipGroup>
          <Chip label="정하지 않음" selected={region == null} onPress={() => touch(setRegion)(null)} />
          {SEA_GROUPS.map((g) => (
            <Chip key={g} label={g} selected={region === g} onPress={() => touch(setRegion)(g)} />
          ))}
        </ChipGroup>
      </Field>

      <Field label="목표 어종 (선택)">
        <SpeciesField value={species} onChange={touch(setSpecies)} />
      </Field>

      <Field label="제목 (선택)">
        <TextField value={title} onChangeText={touch(setTitle)} placeholder={autoTitle} maxLength={60} />
      </Field>

      <Field label="메모 (선택)">
        <TextField value={memo} onChangeText={touch(setMemo)} placeholder="예: 새벽 4시 출발, 동행 2명" multiline maxLength={1000} />
      </Field>

      {!initial ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DEFAULT_CHECKLIST_HINT}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      {!signedIn ? (
        <ThemedText type="small" themeColor="textSecondary">
          저장은 로그인 후에 돼요. 「계획 만들기」를 누르면 로그인 화면으로 가고, 로그인하면 작성한 내용이 그대로 남아 있어요.
        </ThemedText>
      ) : d && !initial ? (
        <ThemedText type="small" themeColor="tint">
          작성하던 내용을 불러왔어요. 「계획 만들기」를 누르면 계정에 저장돼요.
        </ThemedText>
      ) : null}
      <Button
        label={save.isPending ? '저장 중…' : initial ? '수정 저장' : signedIn ? '계획 만들기' : '로그인하고 계획 만들기'}
        disabled={save.isPending}
        onPress={submit}
      />
      {!initial && (d || dirty) ? (
        <Button
          label="작성 취소"
          variant="secondary"
          onPress={() => {
            setTripDraft(null);
            router.back();
          }}
        />
      ) : null}
      {!initial ? (
        <ThemedText type="small" themeColor="textSecondary">
          작성 중인 내용은 이 기기에 임시로 저장돼요. 계정에 저장하거나 「작성 취소」를 누르면 지워지고, 7일이 지나거나 날짜가 지나면 자동으로
          지워져요.
        </ThemedText>
      ) : null}
    </StackScreen>
  );
}

export default function NewTripScreen() {
  return <TripFormScreen />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
