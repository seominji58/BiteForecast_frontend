import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { DataStatus, Place, PlaceSummary } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Breakdown, Criteria } from '@/lib/criteria';
import { freshnessLine, WARNING_SHORT } from '@/lib/criteria';
import { distLabel, km, PLACE_IMAGE, recommendable } from '@/lib/place';

/**
 * 「조건으로 찾기」 결과 세 가지 상태 (사용자 피드백 2026-11-09).
 * - 맞는 곳 있음: 가까운 순 몇 곳 + 근거 수치(예보 최대)
 * - 맞는 곳 없음: 어떤 이유로 빠졌는지 + 기준 바꾸기 / 지도에서 둘러보기 (조건 밖 곳을 추천처럼 보여주지 않음)
 * - 자료 부족: 판단할 수 없다고 알리고 지도로 연결
 */
export function CriteriaResult({
  b,
  criteria,
  places,
  origin,
  limit = 3,
  onChangeCriteria,
  dataStatus,
  showList = true,
}: {
  /** 자료가 오래됐으면 개수·목록 대신 상태만 안내한다 */
  dataStatus?: DataStatus;
  /** false 면 맞는 곳 목록은 숨기고 개수만 (기준 지역·위치가 없을 때) */
  showList?: boolean;
  b: Breakdown;
  criteria: Criteria;
  places: Place[];
  origin: { lat: number | null; lon: number | null; label: string } | null;
  limit?: number;
  onChangeCriteria: () => void;
}) {
  const theme = useTheme();
  if (dataStatus?.stale) {
    return (
      <View style={styles.box}>
        <ThemedText type="smallBold" themeColor="warning">
          {dataStatus.stale_reason ?? '자료가 오래됐어요'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {freshnessLine(dataStatus)}. 오래된 예보·특보로는 출조 조건을 판단하지 않아요. 출조 전 기상청 특보를 꼭 직접
          확인하세요.
        </ThemedText>
        <Button label="지도에서 낚시터별 자료 보기" variant="secondary" onPress={() => router.push('/explore')} />
      </View>
    );
  }
  if (b.insufficient) {
    return (
      <View style={styles.box}>
        <ThemedText type="smallBold" themeColor="warning">
          해황 자료가 부족해 지금은 판단할 수 없어요
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          전국 {b.total}곳 중 {b.unknown}곳은 예보나 특보 자료가 없어요. 지도에서 낚시터별 자료를 직접 확인해 주세요.
        </ThemedText>
        <Button label="지도에서 둘러보기" variant="secondary" onPress={() => router.push('/explore')} />
      </View>
    );
  }

  if (b.meets.length === 0) {
    const reasons = [
      b.warning ? `해상 특보 발효 중 ${b.warning}곳 (기준과 관계없이 제외)` : null,
      b.unknown ? `예보·특보 자료가 부족한 곳 ${b.unknown}곳` : null,
      b.waveOver ? `파고 예보 최대가 ${criteria.maxWave}m 넘는 곳 ${b.waveOver}곳` : null,
      b.windOver ? `파고는 맞지만 풍속 예보 최대가 ${criteria.maxWind}m/s 넘는 곳 ${b.windOver}곳` : null,
      b.indexLow ? `파고·풍속은 맞지만 바다낚시지수가 ${criteria.minIndex} 미만인 곳 ${b.indexLow}곳` : null,
    ].filter((x): x is string => !!x);
    return (
      <View style={styles.box}>
        <ThemedText type="smallBold">지금 내 기준에 맞는 곳이 없어요</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          전국 {b.total}곳이 빠진 이유 (한 곳당 가장 앞선 이유 하나로 셌어요 · 합계 {b.total}곳)
        </ThemedText>
        {reasons.map((r) => (
          <ThemedText key={r} type="small">
            • {r}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          기준은 내 경험과 장비에 맞게 정하세요. 특보가 발효 중인 곳은 기준과 관계없이 보여드리지 않아요.
        </ThemedText>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button label="기준 바꾸기" variant="secondary" onPress={onChangeCriteria} />
          </View>
          <View style={styles.flex}>
            <Button label="지도에서 둘러보기" variant="secondary" onPress={() => router.push('/explore')} />
          </View>
        </View>
      </View>
    );
  }

  const byId = new Map(places.map((p) => [p.id, p]));
  const rows = b.meets
    .map((s) => ({ s, p: byId.get(s.place_id) }))
    .filter((r): r is { s: PlaceSummary; p: Place } => !!r.p)
    // 좌표 오류 의심 곳은 목록에서 뺀다
    .filter((r) => recommendable(r.p))
    .map((r) => ({ ...r, d: origin ? km(origin, r.p) : null }))
    // 위치가 있으면 거리순, 없으면 지역·이름순 (임의 기준의 「가까운 순」 없음)
    .sort((x, y) =>
      x.d != null && y.d != null
        ? x.d - y.d
        : x.p.region_name.localeCompare(y.p.region_name) || x.p.name.localeCompare(y.p.name),
    )
    .slice(0, limit);

  if (!showList) return null;

  return (
    <View style={styles.box}>
      {rows.map(({ s, p, d }) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/place/[id]', params: { id: String(p.id) } })}
          style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
          <AppIcon name={PLACE_IMAGE[p.type]} size={IconSize.row} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {p.name}
              <ThemedText type="small" themeColor="textSecondary">
                {`  ${distLabel(d, p) ?? p.region_name}`}
              </ThemedText>
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              예보 최대 파고 {s.wave_fc_max?.v}m · 풍속 {s.wind_fc_max?.v}m/s
              {s.warning_level !== 'none' ? ` · ${WARNING_SHORT[s.warning_level].text}` : ''}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  box: { gap: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
});
