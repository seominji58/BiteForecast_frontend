import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCompare, useDateRange, usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { CompareView, type CompareFocus } from '@/components/compare-view';
import { Dropdown } from '@/components/dropdown';
import { Chip } from '@/components/form';
import { PlacePicker } from '@/components/place-picker';
import { Card, EmptyView, ErrorView, Loading, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, dayList } from '@/lib/compare';
import { nearby, PLACE_IMAGE } from '@/lib/place';
import { useHomePlace } from '@/lib/prefs';

const FOCUS: { value: CompareFocus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'sea', label: '파도·바람' },
  { value: 'tide', label: '물때' },
  { value: 'index', label: '낚시지수' },
];

// SCR-02 조건 비교 (재설계 v2 §6): A=기준 낚시터(있을 때만), B=가까운 곳 추천 또는 검색, 날짜는 드롭다운
export default function CompareTab() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const places = usePlaces();
  const range = useDateRange();
  const [homeId, , homeLoaded] = useHomePlace();

  const [day, setDay] = useState<string | null>(null);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(params.b ? Number(params.b) : null);
  const [focus, setFocus] = useState<CompareFocus>('all');
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

  const days = range.data ? dayList(range.data.min, range.data.max) : [];
  const selectedDay = day ?? range.data?.today ?? '';
  const dayIdx = days.indexOf(selectedDay);
  const q = useCompare(a?.id ?? NaN, b?.id ?? NaN, selectedDay);

  // B 추천: A에서 가까운 3곳 (A 자신 제외)
  const suggestions = a && places.data ? nearby(a, places.data, 4).filter((n) => n.place.id !== a.id).slice(0, 3) : [];

  return (
    <TabScreen title="조건 비교">
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

      {a && !b && suggestions.length > 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {a.name} 근처에서 B 고르기
          </ThemedText>
          {/* 줄바꿈 칩: 화면 밖으로 잘리지 않게 */}
          <View style={styles.wrap}>
            {suggestions.map(({ place, km }) => (
              <Chip
                key={place.id}
                label={`${place.name} · ${km < 1 ? '1km 미만' : `${Math.round(km)}km`}`}
                selected={false}
                onPress={() => setBId(place.id)}
              />
            ))}
            <Chip label="전국에서 검색" selected={false} onPress={() => setPicking('B')} />
          </View>
        </Card>
      ) : null}

      {a && b ? (
        <View style={styles.focusRow}>
          <ThemedText type="small" themeColor="textSecondary">
            보기
          </ThemedText>
          <View style={[styles.wrap, styles.flex]}>
            {FOCUS.map((f) => (
              <Chip key={f.value} label={f.label} selected={focus === f.value} onPress={() => setFocus(f.value)} />
            ))}
          </View>
        </View>
      ) : null}

      {!a ? (
        <EmptyView message="기준 낚시터가 아직 없어요. A를 눌러 낚시터를 고르면 근처 비교 대상을 추천해 드려요." />
      ) : !b ? null : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <CompareView places={q.data.places} disclaimer={q.data.disclaimer} focus={focus} />
      )}

      <PlacePicker
        visible={picking !== null}
        title={picking === 'A' ? '낚시터 A 선택' : '낚시터 B 선택'}
        selectedId={picking === 'A' ? a?.id : b?.id}
        disabledId={picking === 'A' ? b?.id : a?.id}
        onSelect={(p) => (picking === 'A' ? setAId(p.id) : setBId(p.id))}
        onClose={() => setPicking(null)}
      />
    </TabScreen>
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
        { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
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
        { borderColor: place ? theme.border : Brand.orange, backgroundColor: theme.backgroundElement },
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
  step: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, padding: 8 },
  badge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.navy, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: Brand.onNavy },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
