/** 칭호·포인트·사진 인증 현황 (내정보 → 「칭호·포인트」 화면). 내정보 화면에서 옮겨 왔다 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useMyPoints, useMyTitle } from '@/api/queries';
import type { Journal } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Card, EmptyView, ErrorView, Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, POINT_REASON_LABEL } from '@/lib/format';
import { VERIFY_LABEL } from '@/lib/verification';

export function TitleProgress({ t }: { t: NonNullable<ReturnType<typeof useMyTitle>['data']> }) {
  const theme = useTheme();
  const pct = t.next
    ? Math.max(0, Math.min(100, ((t.total_points - t.current.min_points) / (t.next.min_points - t.current.min_points)) * 100))
    : 100;
  return (
    <Card>
      <View style={styles.between}>
        <View style={styles.inline}>
          <AppIcon name="medal" size={28} />
          <ThemedText type="value">{t.current.name}</ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="tint">
          {t.total_points}P
        </ThemedText>
      </View>
      <View
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t.next ? `다음 칭호 「${t.next.name}」까지 ${t.points_to_next}P` : '최고 칭호입니다'}
      </ThemedText>
    </Card>
  );
}

/** 인증 대기·완료·반려 개수와 처리할 기록 (반려 사유 포함) */
export function VerificationSummary({ journals }: { journals: Journal[] }) {
  const count = (s: Journal['verification']['status']) => journals.filter((j) => j.verification.status === s).length;
  const attention = journals.filter((j) => j.verification.status === 'rejected' || j.verification.status === 'pending');
  const cells: [Journal['verification']['status'], number][] = [
    ['pending', count('pending')],
    ['approved', count('approved')],
    ['rejected', count('rejected')],
  ];
  return (
    <Card>
      <View style={styles.vRow}>
        {cells.map(([s, n]) => (
          <View key={s} style={styles.vCell}>
            <ThemedText type="value" themeColor={n > 0 ? VERIFY_LABEL[s].color : 'textSecondary'}>
              {n}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s === 'pending' ? '검토 중' : s === 'approved' ? '인증 완료' : '반려'}
            </ThemedText>
          </View>
        ))}
      </View>
      {attention.slice(0, 3).map((j) => (
        <Pressable
          key={j.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/journal/[id]', params: { id: String(j.id) } })}
          style={({ pressed }) => [styles.between, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {j.place_name} · {j.species_name ?? '어종 미기록'}
            </ThemedText>
            <ThemedText type="small" themeColor={VERIFY_LABEL[j.verification.status].color} numberOfLines={1}>
              {j.verification.status === 'rejected'
                ? `반려: ${j.verification.reject_reason ?? '사유 없음'}`
                : '관리자 검토 중'}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        포인트는 관리자가 사진을 확인해 인증을 완료한 기록에만 지급돼요. 같은 기록은 한 번만 지급되고, 반려되거나 인증
        내용을 고치면 회수돼요.
      </ThemedText>
    </Card>
  );
}

export function PointHistory() {
  const points = useMyPoints();
  if (points.isPending) return <Loading />;
  if (points.isError) return <ErrorView message={points.error.message} onRetry={() => points.refetch()} />;
  if (points.data.history.length === 0)
    return <EmptyView message="아직 포인트가 없어요. 사진 인증이 완료된 기록부터 포인트가 쌓여요." />;
  return (
    <Card>
      {points.data.history.slice(0, 15).map((h) => (
        <View key={h.id} style={styles.between}>
          <View style={styles.flex}>
            <ThemedText>{POINT_REASON_LABEL[h.reason]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(h.created_at)}
              {h.delta < 0 ? ' · 반려·수정·삭제로 회수' : ''}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor={h.delta < 0 ? 'danger' : 'success'}>
            {h.delta > 0 ? `+${h.delta}` : h.delta}P
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%' },
  vRow: { flexDirection: 'row' },
  vCell: { flex: 1, alignItems: 'center' },
});
