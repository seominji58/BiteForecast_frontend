import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useCompare, useDateRange, usePlaces } from '@/api/queries';
import type { Place } from '@/api/types';
import { CompareView } from '@/components/compare-view';
import { Chip } from '@/components/form';
import { PlacePicker } from '@/components/place-picker';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, dayList } from '@/lib/compare';
import { PLACE_ICON } from '@/lib/place';

// SCR-02 조건 비교 (FR-02~05, FR-07): 날짜 + A/B 낚시터 선택 → 같은 화면에 결과
export default function CompareTab() {
  const params = useLocalSearchParams<{ a?: string }>();
  const places = usePlaces();
  const range = useDateRange();

  const [day, setDay] = useState<string | null>(null);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);
  const [picking, setPicking] = useState<'A' | 'B' | null>(null);

  // 홈에서 「비교하기」로 들어오면 그 낚시터를 A 로 (직접 고르면 그 값 우선)
  const effectiveA = aId ?? (params.a ? Number(params.a) : null);
  const a = places.data?.find((p) => p.id === effectiveA) ?? null;
  const b = places.data?.find((p) => p.id === bId && p.id !== effectiveA) ?? null;
  const selectedDay = day ?? range.data?.today ?? '';
  const q = useCompare(a?.id ?? NaN, b?.id ?? NaN, selectedDay);

  return (
    <TabScreen title="조건 비교" subtitle="두 낚시터의 바다 조건을 한눈에 비교하세요.">
      <Card>
        <View style={styles.inline}>
          <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Brand.orange} />
          <ThemedText type="smallBold">비교 기준일</ThemedText>
        </View>
        {range.isSuccess ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {dayList(range.data.min, range.data.max).map((d) => (
              <Chip
                key={d}
                label={d === range.data.today ? `오늘 ${dayLabel(d)}` : dayLabel(d)}
                selected={d === selectedDay}
                onPress={() => setDay(d)}
              />
            ))}
          </ScrollView>
        ) : range.isError ? (
          <ErrorView message={range.error.message} onRetry={() => range.refetch()} />
        ) : (
          <Loading />
        )}
      </Card>

      <SectionHeader icon="map-marker" title="비교 낚시터" />
      <View style={styles.slots}>
        <Slot label="A" place={a} onPress={() => setPicking('A')} />
        <View style={styles.vs}>
          <ThemedText type="smallBold" style={styles.vsText}>
            VS
          </ThemedText>
        </View>
        <Slot label="B" place={b} onPress={() => setPicking('B')} />
      </View>

      {!a || !b ? (
        <EmptyView message="A와 B를 눌러 비교할 낚시터 2곳을 선택하세요." />
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorView message={q.error.message} onRetry={() => q.refetch()} />
      ) : (
        <CompareView places={q.data.places} disclaimer={q.data.disclaimer} />
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

function Slot({ label, place, onPress }: { label: string; place: Place | null; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`낚시터 ${label}: ${place?.name ?? '선택 안 됨'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.slot, { borderColor: theme.border }, pressed && styles.pressed]}>
      <LinearGradient colors={[Brand.teal, Brand.navy]} style={styles.slotArt}>
        <MaterialCommunityIcons
          name={place ? PLACE_ICON[place.type] : 'plus-circle-outline'}
          size={26}
          color="rgba(255,255,255,0.9)"
        />
        <ThemedText type="smallBold" style={styles.slotLabel}>
          {label}
        </ThemedText>
      </LinearGradient>
      <View style={[styles.slotInfo, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {place?.name ?? '선택하기'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {place ? '눌러서 변경' : '낚시터 고르기'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  days: { gap: Spacing.two, paddingRight: Spacing.three },
  slots: { flexDirection: 'row', alignItems: 'center' },
  slot: { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  slotArt: { height: 64, alignItems: 'center', justifyContent: 'center' },
  slotLabel: { position: 'absolute', top: 6, left: 10, color: Brand.onNavy },
  slotInfo: { padding: Spacing.two, gap: 2 },
  vs: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: -10,
    zIndex: 1,
    backgroundColor: Brand.navy,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { color: Brand.onNavy },
  pressed: { opacity: 0.85 },
});
