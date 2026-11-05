import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDateRange, useHealth, usePlaces, useRegions } from '@/api/queries';
import type { Place } from '@/api/types';
import { Button, Chip, ChipGroup } from '@/components/form';
import { Card, EmptyView, ErrorView, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { dayLabel, dayList } from '@/lib/compare';

// SCR-01 홈 / 장소 선택 (FR-01, FR-02): 장소 2곳 + 날짜를 골라 비교 화면으로 이동
export default function HomeScreen() {
  const health = useHealth();
  const places = usePlaces();
  const regions = useRegions();
  const range = useDateRange();

  const [a, setA] = useState<Place | null>(null);
  const [b, setB] = useState<Place | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const selectedDay = day ?? range.data?.today ?? null;

  // 선택 규칙: 선택된 장소를 누르면 해제, 아니면 빈 슬롯(A→B)에 넣고 둘 다 차 있으면 B 를 교체
  const toggle = (p: Place) => {
    if (a?.id === p.id) return setA(null);
    if (b?.id === p.id) return setB(null);
    if (!a) return setA(p);
    setB(p);
  };

  const canCompare = !!a && !!b && a.id !== b.id && !!selectedDay;

  return (
    <Screen title="입질예보">
      {health.isError && (
        <Card>
          <ThemedText themeColor="danger">서버 연결 안 됨: {health.error.message}</ThemedText>
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">비교할 장소 2곳</ThemedText>
        <View style={styles.slots}>
          <Slot label="A" place={a} onClear={() => setA(null)} />
          <Slot label="B" place={b} onClear={() => setB(null)} />
        </View>
      </Card>

      <ThemedText type="smallBold">날짜</ThemedText>
      {range.isSuccess && selectedDay ? (
        <ChipGroup>
          {dayList(range.data.min, range.data.max).map((d) => (
            <Chip
              key={d}
              label={d === range.data.today ? `오늘 ${dayLabel(d)}` : dayLabel(d)}
              selected={d === selectedDay}
              onPress={() => setDay(d)}
            />
          ))}
        </ChipGroup>
      ) : range.isError ? (
        <ErrorView message={range.error.message} onRetry={() => range.refetch()} />
      ) : (
        <Loading />
      )}

      <Button
        label={canCompare ? `${a!.name} vs ${b!.name} 비교하기` : '장소 2곳을 선택하세요'}
        disabled={!canCompare}
        onPress={() =>
          router.push({
            pathname: '/compare',
            params: { a: String(a!.id), b: String(b!.id), date: selectedDay! },
          })
        }
      />

      <ThemedText type="smallBold">낚시 장소</ThemedText>
      {places.isPending && <Loading />}
      {places.isError && <ErrorView message={places.error.message} onRetry={() => places.refetch()} />}
      {places.isSuccess &&
        (places.data.length === 0 ? (
          <EmptyView message="지원 지역이 아닙니다" />
        ) : (
          (regions.data ?? [{ id: -1, name: '전체' }]).map((r) => {
            const list = r.id === -1 ? places.data : places.data.filter((p) => p.region_id === r.id);
            if (list.length === 0) return null;
            return (
              <Card key={r.id}>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.name}
                </ThemedText>
                <ChipGroup>
                  {list.map((p) => (
                    <Chip
                      key={p.id}
                      label={a?.id === p.id ? `A · ${p.name}` : b?.id === p.id ? `B · ${p.name}` : p.name}
                      selected={a?.id === p.id || b?.id === p.id}
                      onPress={() => toggle(p)}
                    />
                  ))}
                </ChipGroup>
              </Card>
            );
          })
        ))}

      <ThemedText type="small" themeColor="textSecondary">
        목록의 장소를 낚시 허용구역으로 보증하지 않습니다. 출조 전 현장 출입 제한을 확인하세요.
      </ThemedText>
    </Screen>
  );
}

function Slot({ label, place, onClear }: { label: string; place: Place | null; onClear: () => void }) {
  return (
    <View style={styles.slot}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {place ? (
        <Chip label={`${place.name}  ✕`} selected onPress={onClear} />
      ) : (
        <ThemedText themeColor="textSecondary">선택 안 됨</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slots: { gap: Spacing.two },
  slot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
});
