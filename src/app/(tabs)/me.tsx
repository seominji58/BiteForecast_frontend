import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';

import { useJournals, useMyPoints, useMyTitle } from '@/api/queries';
import type { Journal } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { LoginRequired } from '@/components/login-required';
import { FavoritesSection, MemberBenefits, RecentPlacesSection } from '@/components/me-extras';
import { Card, EmptyView, ErrorView, Loading, SectionHeader, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatDateTime, POINT_REASON_LABEL } from '@/lib/format';
import { VERIFY_LABEL } from '@/lib/verification';

// SCR-06 내정보: 계정 + 칭호·포인트(FR-11, 12) + 기록 요약(FR-13) + 설정 진입(SCR-07)
export default function MeScreen() {
  const title = useMyTitle();
  const journals = useJournals();
  const { status, account } = useAuth();

  if (status !== 'signed-in') {
    return (
      <TabScreen title="내정보">
        {status === 'loading' ? (
          <Loading />
        ) : (
          <LoginRequired
            icon="medal"
            title="로그인하고 칭호를 모아 보세요"
            message="사진 인증을 받은 기록마다 포인트가 쌓이고 칭호가 올라가요. 해황 보기는 로그인 없이도 쓸 수 있어요."
          />
        )}
        <RecentPlacesSection />
        <MemberBenefits />
        <SettingsRow />
      </TabScreen>
    );
  }

  return (
    <TabScreen title="내정보">
      <ProfileCard nickname={account?.nickname} titleName={title.data?.current.name} journals={journals.data} />

      <SectionHeader title="사진 인증 현황" actionLabel="기록 보기" onAction={() => router.push('/records')} />
      {journals.isSuccess ? <VerificationSummary journals={journals.data} /> : null}

      <SectionHeader title="칭호" />
      {title.isPending && <Loading />}
      {title.isError && <ErrorView message={title.error.message} onRetry={() => title.refetch()} />}
      {title.isSuccess && <TitleProgress t={title.data} />}

      <SectionHeader title="포인트 내역" />
      <PointHistory />

      <FavoritesSection />
      <RecentPlacesSection />

      <SettingsRow />
      <AccountSection />
    </TabScreen>
  );
}

function SettingsRow() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.menuRow}>
        <AppIcon name="regulation" size={26} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">설정·정보</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            데이터 출처, 이용 안내
          </ThemedText>
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Card>
    </Pressable>
  );
}

/** 계정: 로그인 수단, 약관, 로그아웃, 탈퇴 (앱스토어 5.1.1: 앱 안에서 계정 삭제 가능해야 함) */
function AccountSection() {
  const { account, signOut } = useAuth();
  const qc = useQueryClient();
  if (!account) return null;

  const confirmDelete = () =>
    Alert.alert(
      '회원 탈퇴',
      '낚시 기록·사진·글·댓글·포인트가 모두 삭제되고 되돌릴 수 없어요. 탈퇴할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () =>
            api
              .deleteAccount()
              .then(async () => {
                await signOut();
                qc.clear();
                Alert.alert('탈퇴했어요', '그동안 이용해 주셔서 감사합니다.');
              })
              .catch((e: Error) => Alert.alert('탈퇴하지 못했어요', e.message)),
        },
      ],
    );

  return (
    <>
      <SectionHeader title="계정" />
      <Card>
        <View style={styles.between}>
          <ThemedText type="small" themeColor="textSecondary">
            로그인
          </ThemedText>
          <ThemedText type="smallBold">
            {account.provider === 'google' ? '구글' : '이메일'}
            {account.email ? ` · ${account.email}` : ''}
          </ThemedText>
        </View>
        <View style={styles.links}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={6}>
            <ThemedText type="small" themeColor="tint">
              이용약관
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={6}>
            <ThemedText type="small" themeColor="tint">
              개인정보 처리방침
            </ThemedText>
          </Pressable>
        </View>
        <Button label="로그아웃" variant="secondary" onPress={() => signOut()} />
        <Pressable accessibilityRole="button" onPress={confirmDelete} hitSlop={8} style={styles.deleteLink}>
          <ThemedText type="small" themeColor="textSecondary">
            회원 탈퇴
          </ThemedText>
        </Pressable>
      </Card>
    </>
  );
}

function ProfileCard({
  nickname,
  titleName,
  journals,
}: {
  nickname?: string;
  titleName?: string;
  journals?: Journal[];
}) {
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
          <AppIcon name="tab-me-active" size={34} tint={Brand.onNavySecondary} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="sectionTitle" style={styles.onNavy}>
            {nickname ?? '낚시인'}
          </ThemedText>
          {titleName ? (
            <View style={styles.badge}>
              <AppIcon name="medal" size={14} />
              <ThemedText type="small" style={styles.badgeText}>
                {titleName}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText type="small" style={styles.onNavySecondary}>
            내 기록은 계정에 보관돼요 · 기기를 바꿔도 이어져요
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

/** 인증 대기·완료·반려 개수와 처리할 기록 (반려 사유 포함) */
function VerificationSummary({ journals }: { journals: Journal[] }) {
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

function PointHistory() {
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
  vRow: { flexDirection: 'row' },
  links: { flexDirection: 'row', gap: 16 },
  deleteLink: { alignSelf: 'center', paddingVertical: 4 },
  vCell: { flex: 1, alignItems: 'center' },
});
