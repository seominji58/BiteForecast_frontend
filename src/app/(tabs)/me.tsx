import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useMyTitle, useRecordSummary } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { FavoritesSection, RecentPlacesSection } from '@/components/me-extras';
import { Card, Loading, TabScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { kakaoUnlink } from '@/lib/kakao';

/**
 * 내정보 (기본 프로필, 2026-11-16)
 * - 로그인 전: 「로그인 / 회원가입」 하나 + 최근 본 낚시터(가로 한 줄) + 설정
 * - 로그인 후: 프로필(닉네임·칭호·로그인 수단) → 요약 3칸 → 메뉴 → 즐겨찾기·최근 → 계정(로그아웃·탈퇴)
 * 칭호·포인트·인증 현황은 「칭호·포인트」 화면, 도감·최대어는 「내 낚시 요약」 화면에서 본다
 */
const PROVIDER_NAME: Record<string, string> = { email: '이메일', google: '구글', kakao: '카카오' };

export default function MeScreen() {
  const { status } = useAuth();
  return (
    <TabScreen title="내정보">
      {status === 'loading' ? <Loading /> : status === 'signed-in' ? <SignedIn /> : <Guest />}
    </TabScreen>
  );
}

function Guest() {
  return (
    <>
      <View style={styles.profile}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <AppIcon name="tab-me-active" size={34} tint={Brand.onNavySecondary} />
          </View>
          <View style={styles.flex}>
            <ThemedText type="sectionTitle" style={styles.onNavy}>
              로그인하고 시작해요
            </ThemedText>
            <ThemedText type="small" style={styles.onNavySecondary}>
              기록·도감·칭호가 계정에 보관돼 기기를 바꿔도 이어져요
            </ThemedText>
          </View>
        </View>
        <Button label="로그인 / 회원가입" onPress={() => router.push('/login')} />
      </View>

      <RecentPlacesSection />

      <Card style={styles.menu}>
        <MenuRow icon="regulation" label="설정·정보" sub="데이터 출처, 이용 안내, 약관" href="/settings" last />
      </Card>
    </>
  );
}

function SignedIn() {
  const theme = useTheme();
  const { account } = useAuth();
  const title = useMyTitle();
  const summary = useRecordSummary();
  if (!account) return null;
  const s = summary.data;
  const best = s?.species
    .filter((x) => x.best_length_cm != null)
    .sort((a, b) => b.best_length_cm! - a.best_length_cm!)[0];
  const via = (account.providers?.length ? account.providers : [account.provider]).map((p) => PROVIDER_NAME[p] ?? p);

  return (
    <>
      <View style={styles.profile}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <AppIcon name="tab-me-active" size={34} tint={Brand.onNavySecondary} />
          </View>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <ThemedText type="sectionTitle" style={[styles.onNavy, styles.flex]} numberOfLines={1}>
                {account.nickname}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="닉네임 변경"
                hitSlop={8}
                onPress={() => router.push('/profile-edit')}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
                <ThemedText type="small" style={styles.onNavy}>
                  닉네임 변경
                </ThemedText>
              </Pressable>
            </View>
            {title.data ? (
              <View style={styles.badge}>
                <AppIcon name="medal" size={14} />
                <ThemedText type="small" style={styles.badgeText}>
                  {title.data.current.name} · {title.data.total_points}P
                </ThemedText>
              </View>
            ) : null}
            <ThemedText type="small" style={styles.onNavySecondary} numberOfLines={1}>
              {via.join('·')}로 로그인 중{account.email ? ` · ${account.email}` : ''}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.statsCard, { backgroundColor: theme.backgroundElement }]}>
          <Stat icon="trips" label="출조" value={s ? `${s.trip_days}일` : '–'} />
          <Stat icon="total-fish" label="잡은 어종" value={s ? `${s.species.length}종` : '–'} />
          <Stat icon="trophy" label="최대어" value={best ? `${best.best_length_cm}cm` : '–'} sub={best?.species_name} />
        </View>
      </View>

      <Card style={styles.menu}>
        <MenuRow icon="total-fish" label="내 낚시 요약·도감" sub="첫 포획, 어종별 최대어" href="/my-records" />
        <MenuRow icon="medal" label="칭호·포인트" sub="사진 인증 현황, 포인트 내역" href="/my-points" />
        <MenuRow icon="regulation" label="설정·정보" sub="차단한 사용자, 데이터 출처, 약관" href="/settings" last />
      </Card>

      <FavoritesSection />
      <RecentPlacesSection />

      <AccountSection />
    </>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  href,
  last,
}: {
  icon: AppIconName;
  label: string;
  sub?: string;
  href: Href;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <AppIcon name={icon} size={24} />
      <View style={styles.flex}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

/** 계정: 약관, 로그아웃, 탈퇴 (앱 안에서 계정 삭제 가능해야 함) */
function AccountSection() {
  const { account, signOut } = useAuth();
  const qc = useQueryClient();
  if (!account) return null;

  const confirmSignOut = () =>
    Alert.alert('로그아웃할까요?', '기록은 계정에 그대로 남아요. 다시 로그인하면 이어서 볼 수 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', onPress: () => signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert('회원 탈퇴', '낚시 기록·사진·글·댓글·포인트가 모두 삭제되고 되돌릴 수 없어요. 탈퇴할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: () =>
          api
            .deleteAccount()
            .then(async () => {
              // 카카오로 가입했으면 카카오 연결도 끊는다 (앱에서 SDK 로, 실패해도 탈퇴는 이미 끝남)
              if (account.providers?.includes('kakao') || account.provider === 'kakao') await kakaoUnlink();
              await signOut();
              qc.clear();
              Alert.alert('탈퇴했어요', '그동안 이용해 주셔서 감사합니다.');
            })
            .catch((e: Error) => Alert.alert('탈퇴하지 못했어요', e.message)),
      },
    ]);

  return (
    <>
      <Button label="로그아웃" variant="secondary" onPress={confirmSignOut} />
      <Pressable accessibilityRole="button" onPress={confirmDelete} hitSlop={8} style={styles.deleteLink}>
        <ThemedText type="small" themeColor="textSecondary">
          회원 탈퇴
        </ThemedText>
      </Pressable>
    </>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profile: { backgroundColor: Brand.navy, borderRadius: 20, padding: Spacing.three, gap: Spacing.three },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
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
  menu: { paddingVertical: 0, gap: 0 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 60, paddingVertical: 10 },
  deleteLink: { alignSelf: 'center', paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
});
