import { Pressable, StyleSheet, View } from 'react-native';

import type { Place, PlaceCompare } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { MarineWarningBanner } from '@/components/marine-warning-banner';
import { Card, ErrorView, Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dayLabel, timeLabel } from '@/lib/compare';
import { PLACE_IMAGE } from '@/lib/place';
import { farNote, indexLine, keyMetrics, tideLine } from '@/lib/summary';

/**
 * 홈 요약 카드 (재설계 v2 §4-2). 위→아래: 장소·기준 → 해상 특보(항상) → 핵심 3수치 → 물때·지수 → 행동 버튼.
 * 긴 설명·출처는 상세 해황 화면으로 보낸다.
 */
export function SeaSummaryCard({
  place,
  pc,
  generatedAt,
  today,
  loading,
  error,
  onChangePlace,
  onDetail,
  onCompare,
}: {
  place: Place;
  pc: PlaceCompare | undefined;
  generatedAt: string | undefined;
  today: string | undefined;
  loading: boolean;
  error: { message: string; retry: () => void } | null;
  onChangePlace: () => void;
  onDetail: () => void;
  onCompare: () => void;
}) {
  const theme = useTheme();
  const note = pc ? farNote(pc) : null;

  return (
    <Card style={styles.card}>
      {/* 장소 · 기준 */}
      <View style={styles.between}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`기준 낚시터 ${place.name}, 바꾸기`}
          onPress={onChangePlace}
          hitSlop={6}
          style={styles.placeRow}>
          <AppIcon name={PLACE_IMAGE[place.type]} size={24} />
          <ThemedText type="sectionTitle" numberOfLines={1} style={styles.shrink}>
            {place.name}
          </ThemedText>
          <ThemedText themeColor="tint">▾</ThemedText>
        </Pressable>
        {today ? (
          <ThemedText type="small" themeColor="textSecondary">
            {dayLabel(today)}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {place.region_name} · 선택한 낚시터 기준{generatedAt ? ` · ${timeLabel(generatedAt)} 갱신` : ''}
      </ThemedText>

      {loading ? <Loading /> : null}
      {error ? <ErrorView message={error.message} onRetry={error.retry} /> : null}

      {pc ? (
        <>
          {/* 해상 특보: 안전 정보라 항상 표시 */}
          <MarineWarningBanner w={pc.warning} />

          {/* 핵심 3수치 */}
          <View style={[styles.metrics, { borderColor: theme.border }]}>
            {keyMetrics(pc).map((m) => (
              <View key={m.label} style={styles.metric}>
                <ThemedText type="small" themeColor="textSecondary">
                  {m.label}
                </ThemedText>
                <ThemedText type="value" numberOfLines={1} adjustsFontSizeToFit themeColor={m.value ? 'text' : 'textSecondary'}>
                  {m.value ?? '–'}
                </ThemedText>
                {m.grade ? <ThemedText type="smallBold">{m.grade}</ThemedText> : null}
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {m.basis}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* 물때 · 공식 지수 */}
          <View style={styles.lines}>
            <InfoLine label="물때" value={tideLine(pc)} />
            <InfoLine label="바다낚시지수" value={indexLine(pc)} hint="국립해양조사원" />
            {note ? (
              <ThemedText type="small" themeColor="textSecondary">
                ⓘ {note}
              </ThemedText>
            ) : null}
          </View>

          {/* 다음 행동: 주 버튼 하나 */}
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="상세 해황" variant="secondary" onPress={onDetail} />
            </View>
            <View style={styles.flex}>
              <Button label="다른 곳과 비교" onPress={onCompare} />
            </View>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            실제 조과를 보장하지 않아요 · 출조 전 특보와 현장 출입 제한을 확인하세요
          </ThemedText>
        </>
      ) : null}
    </Card>
  );
}

function InfoLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.infoLine}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
        {value}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  center: { textAlign: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10 },
  metric: { flex: 1, alignItems: 'center', gap: 1 },
  lines: { gap: 4 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { width: 76 },
  actions: { flexDirection: 'row', gap: 8 },
});
