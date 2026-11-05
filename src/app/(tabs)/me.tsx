import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useJournals, useMyPoints, useMyTitle } from '@/api/queries';
import type { Journal } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime, POINT_REASON_LABEL } from '@/lib/format';

// SCR-06 내정보: 칭호·포인트(FR-11, 12) + 기록 요약(FR-13) + 설정 진입(SCR-07)
export default function MeScreen() {
  const title = useMyTitle();
  const journals = useJournals();

  return (
    <TabScreen title="내정보" subtitle="나의 낚시 기록과 활약을 한눈에!">
      <ProfileCard titleName={title.data?.current.name} journals={journals.data} />

      <SectionHeader image="medal" title="칭호" />
      {title.isPending && <Loading />}
      {title.isError && <ErrorView message={title.error.message} onRetry={() => title.refetch()} />}
      {title.isSuccess && <TitleProgress t={title.data} />}

      <SectionHeader image="trophy" title="포인트 내역" />
      <PointHistory />

      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => pressed && styles.pressed}>
        <Card style={styles.menuRow}>
          <MaterialCommunityIcons name="cog-outline" size={24} color={Brand.teal} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">설정·정보</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              데이터 출처, 이용 안내
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} />
        </Card>
      </Pressable>
    </TabScreen>
  );
}

function ProfileCard({ titleName, journals }: { titleName?: string; journals?: Journal[] }) {
  const theme = useTheme();
  const list = journals ?? [];
  const total = list.reduce((sum, j) => sum + (j.count ?? 0), 0);
  const best = list
    .filter((j) => j.max_length_cm != null)
    .sort((a, b) => (b.max_length_cm ?? 0) - (a.max_length_cm ?? 0))[0];

  return (
    <View style={styles.profile}>
      <View style={styles.profileTop}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-circle" size={52} color={Brand.onNavySecondary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="sectionTitle" style={styles.onNavy}>
            익명 낚시인
          </ThemedText>
          {titleName ? (
            <View style={styles.badge}>
              <MaterialCommunityIcons name="crown" size={14} color={Brand.orange} />
              <ThemedText type="small" style={styles.badgeText}>
                {titleName}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="small" style={styles.onNavySecondary}>
            로그인 없이 이 기기에 연결된 기록입니다
          </ThemedText>
        </View>
      </View>
      <View style={[styles.statsCard, { backgroundColor: theme.backgroundElement }]}>
        <Stat icon="trips" label="출조 횟수" value={`${list.length}회`} />
        <Stat icon="total-fish" label="총 마릿수" value={`${total.toLocaleString()}마리`} />
        <Stat
          icon="trophy"
          label="최대어"
          value={best ? `${best.max_length_cm}cm` : '–'}
          sub={best?.species_name ?? undefined}
        />
      </View>
    </View>
  );
}

function Stat({ icon, label, value, sub }: { icon: AppIconName; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.inline}>
        <AppIcon name={icon} size={20} />
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
      <ThemedText type="value" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {sub ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </View>
  );
}

function TitleProgress({ t }: { t: NonNullable<ReturnType<typeof useMyTitle>['data']> }) {
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

function PointHistory() {
  const points = useMyPoints();
  if (points.isPending) return <Loading />;
  if (points.isError) return <ErrorView message={points.error.message} onRetry={() => points.refetch()} />;
  if (points.data.history.length === 0) return <EmptyView message="낚시일지를 작성하면 포인트가 쌓입니다." />;
  return (
    <Card>
      {points.data.history.slice(0, 15).map((h) => (
        <View key={h.id} style={styles.between}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  profile: { backgroundColor: Brand.navy, borderRadius: 20, padding: Spacing.three, gap: Spacing.three },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  onNavy: { color: Brand.onNavy },
  onNavySecondary: { color: Brand.onNavySecondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.orange,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 1,
    marginVertical: 4,
  },
  badgeText: { color: Brand.orange, fontWeight: '700' },
  statsCard: { flexDirection: 'row', borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  stat: { flex: 1, gap: 2, alignItems: 'center' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
