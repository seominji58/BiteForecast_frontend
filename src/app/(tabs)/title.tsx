import { StyleSheet, View } from 'react-native';

import { useMyTitle } from '@/api/queries';
import { Card, ErrorView, Loading, Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// SCR-06 활동·칭호 (FR-11, FR-12) — TODO: 포인트 내역
export default function TitleScreen() {
  const theme = useTheme();
  const title = useMyTitle();

  return (
    <Screen title="칭호">
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
    </Screen>
  );
}

function progress(total: number, from: number, to: number) {
  return Math.max(0, Math.min(100, ((total - from) / (to - from)) * 100));
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.two },
  bar: { height: '100%' },
});
