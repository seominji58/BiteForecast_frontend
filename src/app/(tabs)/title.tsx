import { StyleSheet, View } from 'react-native';

import { useMyPoints, useMyTitle } from '@/api/queries';
import { Card, EmptyView, ErrorView, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, POINT_REASON_LABEL } from '@/lib/format';

// SCR-06 활동·칭호 (FR-11, FR-12)
export default function TitleScreen() {
  return (
    <Screen title="칭호">
      <TitleCard />
      <ThemedText type="smallBold">포인트 내역</ThemedText>
      <PointHistory />
    </Screen>
  );
}

function PointHistory() {
  const points = useMyPoints();
  if (points.isPending) return <Loading />;
  if (points.isError) return <ErrorView message={points.error.message} onRetry={() => points.refetch()} />;
  if (points.data.history.length === 0) return <EmptyView message="낚시일지를 작성하면 포인트가 쌓입니다." />;

  return (
    <Card>
      {points.data.history.map((h) => (
        <View key={h.id} style={styles.historyRow}>
          <View style={styles.flex}>
            <ThemedText>{POINT_REASON_LABEL[h.reason]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(h.created_at)}
              {h.delta < 0 ? ' · 기록 변경으로 회수' : ''}
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

function TitleCard() {
  const theme = useTheme();
  const title = useMyTitle();

  return (
    <>
      {title.isPending && <Loading />}
      {title.isError && <ErrorView message={title.error.message} onRetry={() => title.refetch()} />}
      {title.isSuccess && (
        <Card>
          <ThemedText themeColor="textSecondary">현재 칭호</ThemedText>
          <ThemedText type="subtitle">{title.data.current.name}</ThemedText>
          <ThemedText>총 {title.data.total_points}P</ThemedText>

          {title.data.next ? (
            <>
              <View
                style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: title.data.current.min_points,
                  max: title.data.next.min_points,
                  now: title.data.total_points,
                }}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: theme.tint,
                      width: `${progress(title.data.total_points, title.data.current.min_points, title.data.next.min_points)}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText themeColor="textSecondary">
                「{title.data.next.name}」까지 {title.data.points_to_next}P
              </ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">최고 칭호입니다.</ThemedText>
          )}
        </Card>
      )}
    </>
  );
}

function progress(total: number, from: number, to: number) {
  return Math.max(0, Math.min(100, ((total - from) / (to - from)) * 100));
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.two },
  bar: { height: '100%' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  flex: { flex: 1 },
});
