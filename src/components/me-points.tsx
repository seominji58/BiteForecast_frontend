/** 칭호·포인트·포인트 쌓는 법 (내정보 → 「칭호·포인트」 화면) */
import { StyleSheet, View } from 'react-native';

import { useMyPoints, useMyTitle } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { Card, EmptyView, ErrorView, Loading } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, POINT_REASON_LABEL } from '@/lib/format';

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

/** 포인트 쌓는 법 (2026-11-23 사진 인증 없앰 — 카페 등급처럼 활동으로) */
const EARN: [string, string][] = [
  ['낚시 기록 남기기', '+10'],
  ['어종·크기까지 적기', '+5'],
  ['처음 가 본 낚시터', '+15'],
  ['같은 어종 최대어 갱신', '+20'],
  ['커뮤니티 글 (하루 3개까지)', '+5'],
  ['댓글 (하루 10개까지)', '+1'],
];
export function HowToEarn() {
  return (
    <Card>
      {EARN.map(([label, p]) => (
        <View key={label} style={styles.between}>
          <ThemedText type="small">{label}</ThemedText>
          <ThemedText type="smallBold" themeColor="success">
            {p}P
          </ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        기록·글을 지우면 그만큼 회수돼요. 포인트가 쌓이면 칭호(입문 → 초보 → 주말 → 베테랑 → 바다의 고수)가 올라가요.
      </ThemedText>
    </Card>
  );
}

export function PointHistory() {
  const points = useMyPoints();
  if (points.isPending) return <Loading />;
  if (points.isError) return <ErrorView message={points.error.message} onRetry={() => points.refetch()} />;
  if (points.data.history.length === 0)
    return <EmptyView message="아직 포인트가 없어요. 낚시 기록을 남기거나 커뮤니티에 글을 쓰면 쌓여요." />;
  return (
    <Card>
      {points.data.history.slice(0, 15).map((h) => (
        <View key={h.id} style={styles.between}>
          <View style={styles.flex}>
            <ThemedText>{POINT_REASON_LABEL[h.reason]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(h.created_at)}
              {h.delta < 0 ? ' · 수정·삭제로 회수' : ''}
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
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%' },
});
