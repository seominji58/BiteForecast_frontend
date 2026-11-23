import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCompare, useDateRange, usePlaces, usePlacesSummary } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { TripAddModal } from '@/components/add-to-trip';
import {
  ComparePanel,
  COMPARE_TABS,
  CompareVerdict,
  HourlySheet,
  SourceSheet,
  type CompareTab,
  type FitRow,
} from '@/components/compare-view';
import { OptionSheet } from '@/components/option-sheet';
import { SegmentTabs } from '@/components/segment-tabs';
import { Dropdown } from '@/components/dropdown';
import { Button, Chip } from '@/components/form';
import { PlacePicker } from '@/components/place-picker';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, dayList } from '@/lib/compare';
import { checkPlace, freshnessLine } from '@/lib/criteria';
import { getCurrentCoords } from '@/lib/location';
import { distLabel, isApprox, km, nearby, PLACE_IMAGE, recommendable } from '@/lib/place';
import { getRecent, pushRecent, RECENT_COMPARES, RECENT_PLACES, useCriteria, useHomePlace } from '@/lib/prefs';

// SCR-02 조건 비교 (재설계 v2 §6): A=기준 낚시터(있을 때만), B=가까운 곳 추천 또는 검색, 날짜는 드롭다운
// 2026-11-09: 탭에서 빠져 화면으로 열린다 (출조계획·홈·상세에서). date 로 날짜를 넘겨받는다
export default function CompareScreen() {
  const params = useLocalSearchParams<{
    a?: string;
    b?: string;
    date?: string;
  }>();
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, , homeLoaded] = useHomePlace();

  const [day, setDay] = useState<string | null>(params.date ?? null);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(params.b ? Number(params.b) : null);
  const days = range.data ? dayList(range.data.min, range.data.max) : [];
  const [tab, setTab] = useState<CompareTab>('summary');
  const [sheet, setSheet] = useState<'hourly' | 'source' | 'trip' | null>(null);
  const [tripTarget, setTripTarget] = useState<{
    placeId: number;
    placeName: string;
  } | null>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);

  // 홈·상세에서 「비교」로 들어오면 그 낚시터가 A (새로 들어올 때마다 직접 고른 값보다 우선)
  const [lastParams, setLastParams] = useState(`${params.a}|${params.b}`);
  if (`${params.a}|${params.b}` !== lastParams) {
    setLastParams(`${params.a}|${params.b}`);
    setAId(null);
    setBId(params.b ? Number(params.b) : null);
  }
  // A 우선순위: 직접 고른 값 → 링크로 받은 값 → 저장된 기준 낚시터. 셋 다 없으면 비워 둔다 (임의로 채우지 않음)
  const candidateA = aId ?? (params.a ? Number(params.a) : homeLoaded ? homeId : null);
  const a = places.data?.find((p) => p.id === candidateA) ?? null;
  const b = places.data?.find((p) => p.id === bId && p.id !== a?.id) ?? null;

  // 넘겨받은 날짜가 비교 가능 범위 밖이면(예: 먼 출조 날짜) 오늘로 보고 안내한다 — 다른 날짜 자료를 그 날짜 것처럼 보여주지 않음
  const outOfRange = !!day && !!range.data && !days.includes(day);
  const selectedDay = (outOfRange ? null : day) ?? range.data?.today ?? '';
  const dayIdx = days.indexOf(selectedDay);
  const q = useCompare(a?.id ?? NaN, b?.id ?? NaN, selectedDay);

  // B 추천: A에서 가까운 3곳 (A 자신 제외)
  const suggestions =
    a && places.data
      ? nearby(a, places.data, 4)
          .filter((n) => n.place.id !== a.id)
          .slice(0, 3)
      : [];

  // 비어 있는 칸부터 채운다 (A 먼저, 그다음 B)
  const pick = (id: number) => (a ? setBId(id) : setAId(id));
  // 두 곳이 정해지면 최근 비교에 남긴다
  useEffect(() => {
    if (a && b) pushRecent(RECENT_COMPARES, `${a.id}-${b.id}`);
  }, [a, b]);

  return (
    <StackScreen>
      <Stack.Screen options={{ title: '조건 비교' }} />
      {outOfRange ? (
        <ThemedText type="small" themeColor="warning">
          {dayLabel(day!)}은 아직 비교할 자료가 없어 오늘 날짜로 보여드려요. 그날 예보는 발표 전이에요.
        </ThemedText>
      ) : null}
      {/* 날짜: ◀ 드롭다운 ▶ (가로 스크롤 칩 대신, 화면 너비 안에 들어간다) */}
      {range.isSuccess ? (
        <View style={styles.dayRow}>
          <StepButton label="이전 날짜" text="‹" disabled={dayIdx <= 0} onPress={() => setDay(days[dayIdx - 1])} />
          <View style={styles.flex}>
            <Dropdown
              label="비교 날짜"
              value={selectedDay}
              options={days.map((d) => ({
                value: d,
                label: d === range.data.today ? `오늘 · ${dayLabel(d)}` : dayLabel(d),
                hint: d < range.data.today ? '지난 날 · 실측 위주' : d > range.data.today ? '예보만' : undefined,
              }))}
              onChange={setDay}
            />
          </View>
          <StepButton
            label="다음 날짜"
            text="›"
            disabled={dayIdx < 0 || dayIdx >= days.length - 1}
            onPress={() => setDay(days[dayIdx + 1])}
          />
        </View>
      ) : range.isError ? (
        <ErrorView message={range.error.message} onRetry={() => range.refetch()} />
      ) : (
        <Loading />
      )}

      <View style={styles.slots}>
        <Slot label="A" place={a} empty="기준 낚시터 고르기" onPress={() => setPicking('A')} />
        <Slot label="B" place={b} empty="비교할 곳 고르기" onPress={() => setPicking('B')} />
      </View>

      {!a || !b ? (
        <PickPanel
          places={places.data ?? []}
          a={a}
          near={suggestions}
          onPick={pick}
          onPair={(x, y) => {
            setAId(x);
            setBId(y);
          }}
          onSearch={() => setPicking(a ? 'B' : 'A')}
        />
      ) : null}

      {!a || !b ? null : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <>
          <VerdictWithFit a={a} b={b} day={selectedDay} future={selectedDay !== range.data?.today} pcs={q.data.places} />
          <SegmentTabs tabs={COMPARE_TABS} value={tab} onChange={setTab} />
          <ComparePanel
            places={q.data.places}
            tab={tab}
            warningNote={
              selectedDay !== range.data?.today
                ? `특보는 지금 발효 상태 (${dayLabel(range.data?.today ?? selectedDay)} 기준) · 그날 특보는 발표 전`
                : undefined
            }
          />
          <Button label="출조계획에 추가" onPress={() => setSheet('trip')} />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="시간별 보기" variant="secondary" onPress={() => setSheet('hourly')} />
            </View>
            <View style={styles.flex}>
              <Button label="자료 기준·출처" variant="secondary" onPress={() => setSheet('source')} />
            </View>
          </View>
          <HourlySheet open={sheet === 'hourly'} onClose={() => setSheet(null)} places={q.data.places} />
          <SourceSheet open={sheet === 'source'} onClose={() => setSheet(null)} places={q.data.places} disclaimer={q.data.disclaimer} />
          <OptionSheet<'A' | 'B'>
            open={sheet === 'trip'}
            title="어느 곳을 출조계획에 넣을까요?"
            options={[
              { value: 'A', label: `A · ${a.name}`, sub: a.region_name },
              { value: 'B', label: `B · ${b.name}`, sub: b.region_name },
            ]}
            value={null}
            onPick={(v) => {
              const p = v === 'A' ? a : b;
              setTimeout(() => setTripTarget({ placeId: p.id, placeName: p.name }), 300);
            }}
            onClose={() => setSheet(null)}
          />
          <TripAddModal target={tripTarget} date={selectedDay} onClose={() => setTripTarget(null)} />
        </>
      )}

      <PlacePicker
        visible={picking !== null}
        title={picking === 'A' ? '낚시터 A 선택' : '낚시터 B 선택'}
        selectedId={picking === 'A' ? a?.id : b?.id}
        disabledId={picking === 'A' ? b?.id : a?.id}
        onSelect={(p) => (picking === 'A' ? setAId(p.id) : setBId(p.id))}
        onClose={() => setPicking(null)}
      />
    </StackScreen>
  );
}

/**
 * 비교할 곳 고르기 (사용자 피드백 2026-11-09: 선택 전 화면이 비어 있음).
 * 최근 비교 · 최근 본 곳 · 내 위치 주변 · 지도 · 검색 중 편한 방법으로 고른다.
 */
function PickPanel({
  places,
  a,
  near: nearA,
  onPick,
  onPair,
  onSearch,
}: {
  places: Place[];
  a: Place | null;
  /** A 근처 추천 (A를 골랐을 때만) */
  near: { place: Place; km: number }[];
  onPick: (id: number) => void;
  onPair: (a: number, b: number) => void;
  onSearch: () => void;
}) {
  const [pairs, setPairs] = useState<[Place, Place][]>([]);
  const [recent, setRecent] = useState<Place[]>([]);
  const [near, setNear] = useState<{
    loading: boolean;
    list: { place: Place; d: number }[];
    error: string | null;
  }>({
    loading: false,
    list: [],
    error: null,
  });
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  useEffect(() => {
    let alive = true;
    getRecent(RECENT_COMPARES).then((list) => {
      if (!alive) return;
      setPairs(
        list
          .map((k) => k.split('-').map(Number))
          .map(([x, y]) => [byId.get(x), byId.get(y)] as const)
          .filter((pr): pr is [Place, Place] => !!pr[0] && !!pr[1])
          .slice(0, 3),
      );
    });
    getRecent(RECENT_PLACES).then((list) => {
      if (alive)
        setRecent(
          list
            .map((k) => byId.get(Number(k)))
            .filter((p): p is Place => !!p)
            .slice(0, 5),
        );
    });
    return () => {
      alive = false;
    };
  }, [byId]);

  const locate = async () => {
    setNear({ loading: true, list: [], error: null });
    const r = await getCurrentCoords();
    if ('error' in r) return setNear({ loading: false, list: [], error: r.error });
    const list = places
      // 좌표 오류 의심·좌표 불일치 의심 곳은 「내 위치 주변」 추천에서 뺀다
      .filter(recommendable)
      .map((p) => ({ place: p, d: km(r.coords, p) }))
      .filter((x) => Number.isFinite(x.d))
      .sort((x, y) => x.d - y.d)
      .slice(0, 5);
    setNear({ loading: false, list, error: null });
  };

  const slot = a ? 'B' : 'A';
  return (
    <Card>
      <ThemedText type="sectionTitle">{a ? `${a.name}와 비교할 곳 고르기` : '비교할 낚시터 두 곳을 골라 주세요'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        고른 곳은 {slot} 칸에 들어가요. 같은 날 특보·파고·바람·물때·수온을 나란히 보여드려요.
      </ThemedText>

      {a && nearA.length ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {a.name} 근처
          </ThemedText>
          <View style={styles.wrap}>
            {nearA.map(({ place, km: d }) => (
              <Chip
                key={place.id}
                label={`${place.name} · ${distLabel(d, place, isApprox(a))}`}
                selected={false}
                onPress={() => onPick(place.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {!a && pairs.length ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            최근 비교
          </ThemedText>
          <View style={styles.wrap}>
            {pairs.map(([x, y]) => (
              <Chip key={`${x.id}-${y.id}`} label={`${x.name} ↔ ${y.name}`} selected={false} onPress={() => onPair(x.id, y.id)} />
            ))}
          </View>
        </>
      ) : null}

      {recent.filter((p) => p.id !== a?.id).length ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            최근 본 곳
          </ThemedText>
          <View style={styles.wrap}>
            {recent
              .filter((p) => p.id !== a?.id)
              .map((p) => (
                <Chip key={p.id} label={p.name} selected={false} onPress={() => onPick(p.id)} />
              ))}
          </View>
        </>
      ) : null}

      {near.list.length ? (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            내 위치 주변
          </ThemedText>
          <View style={styles.wrap}>
            {near.list
              .filter((x) => x.place.id !== a?.id)
              .map(({ place, d }) => (
                <Chip key={place.id} label={`${place.name} · ${distLabel(d, place)}`} selected={false} onPress={() => onPick(place.id)} />
              ))}
          </View>
        </>
      ) : null}
      {near.error ? (
        <ThemedText type="small" themeColor="warning">
          {near.error}
        </ThemedText>
      ) : null}

      <View style={styles.pickActions}>
        <PickButton icon="find-gps" label={near.loading ? '확인 중…' : '내 주변'} onPress={locate} />
        <PickButton
          icon="find-map"
          label="지도에서"
          onPress={() =>
            router.push({
              pathname: '/explore',
              params: a ? { pick: 'compare', a: String(a.id) } : { pick: 'compare' },
            })
          }
        />
        <PickButton icon="find-sea" label="검색" onPress={onSearch} />
      </View>
    </Card>
  );
}

function PickButton({ icon, label, onPress }: { icon: AppIconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pickBtn, { borderColor: theme.border }, pressed && styles.pressed]}>
      <AppIcon name={icon} size={IconSize.row} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

/**
 * 결론 카드 + 내 기준(파고·풍속 상한, 특보) 충족 여부. 위에서 고른 날짜 기준.
 * 내 기준은 전체 요약(오늘이면 지금 이후 예보)으로 계산 — 결론의 하루 최댓값과 기준이 달라 문구로 구분한다.
 * 자료가 오래됐으면 충족 여부를 보여주지 않는다
 */
function VerdictWithFit({
  a,
  b,
  day,
  future,
  pcs,
}: {
  a: Place;
  b: Place;
  day: string;
  future: boolean;
  pcs: import('@/api/types').PlaceCompare[];
}) {
  const summary = usePlacesSummary(day);
  const [criteria] = useCriteria();
  const stale = summary.data?.data_status.stale;
  const fit: FitRow[] | null =
    summary.data && !stale
      ? ([a, b] as const).map((p, i) => {
          const r = checkPlace(
            summary.data.places.find((s) => s.place_id === p.id),
            criteria,
            { future },
          );
          return {
            label: i === 0 ? 'A' : 'B',
            status: r.status,
            notes: r.notes,
          };
        })
      : null;
  return (
    <>
      <CompareVerdict
        a={pcs[0]}
        b={pcs[1]}
        fit={fit}
        fitBasis={future ? `${dayLabel(day)} 예보` : '지금 이후 예보'}
        onCriteria={() => router.push({ pathname: '/explore', params: { mode: 'criteria' } })}
      />
      {stale ? (
        <ThemedText type="small" themeColor="warning">
          {summary.data!.data_status.stale_reason} · {freshnessLine(summary.data!.data_status)} · 오래된 자료라 내 기준 충족 여부는
          보여드리지 않아요
        </ThemedText>
      ) : null}
    </>
  );
}

function StepButton({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        {
          borderColor: theme.backgroundSelected,
          backgroundColor: theme.backgroundElement,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText style={styles.stepText} themeColor="tint">
        {text}
      </ThemedText>
    </Pressable>
  );
}

function Slot({ label, place, empty, onPress }: { label: string; place: Place | null; empty: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`낚시터 ${label}: ${place?.name ?? '선택 안 됨'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        {
          borderColor: place ? theme.border : Brand.orange,
          backgroundColor: theme.backgroundElement,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.badge}>
        <ThemedText type="smallBold" style={styles.badgeText}>
          {label}
        </ThemedText>
      </View>
      {place ? <AppIcon name={PLACE_IMAGE[place.type]} size={26} /> : null}
      <View style={styles.flex}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {place?.name ?? empty}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {place ? place.region_name : '눌러서 선택'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Brand.onNavy },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
});
