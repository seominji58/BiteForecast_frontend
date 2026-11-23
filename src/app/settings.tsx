import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { api, API_URL } from '@/api';
import { useBlocks, useSources, useUnblock } from '@/api/queries';
import { Card, ErrorView, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { KIND_TEXT } from '@/lib/compare';
import { kakaoUnlink } from '@/lib/kakao';

// SCR-07 설정·법적 안내 (FR-15)
// TODO: 이용약관·개인정보 처리방침 링크, 문의처, 내 데이터 삭제 (배포 전 필수)
export default function SettingsScreen() {
  const sources = useSources();

  return (
    <StackScreen>
      <Fold title="데이터 출처" hint={sources.data ? `공공데이터 ${sources.data.length}종` : undefined}>
        {sources.isPending && <Loading />}
        {sources.isError && <ErrorView message={sources.error.message} onRetry={() => sources.refetch()} />}
        {sources.data?.map((s) => (
          <View key={s.dataset} style={styles.row}>
            <ThemedText type="small" themeColor={s.connected ? 'success' : 'textSecondary'} style={styles.status}>
              {s.connected ? '연결' : '준비'}
            </ThemedText>
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                {s.agency} · {s.dataset}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {KIND_TEXT[s.kind]} · {s.connected ? '연결됨' : '준비 중'}
                {s.note ? ` · ${s.note}` : ''}
              </ThemedText>
            </View>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          공공데이터포털(data.go.kr)을 통해 제공받은 공공데이터를 이용합니다.
        </ThemedText>
      </Fold>

      <BlockedUsers />

      <Fold title="이용 안내" hint="예보·지수 해석, 책임 범위">
        <ThemedText type="small" themeColor="textSecondary">
          • 관측소 값은 낚시 장소의 현장 조건과 다를 수 있으며, 관측소까지의 거리를 함께 표시합니다.{'\n'}• 바다낚시지수는 국립해양조사원
          발표값을 그대로 보여주며 앱이 판정한 값이 아닙니다.{'\n'}• 실제 입질·조과를 보장하지 않습니다. 출조 전 공식 특보와 현장 출입
          제한을 확인하세요.{'\n'}• 목록의 장소를 낚시 허용구역으로 보증하지 않습니다.
        </ThemedText>
      </Fold>

      <Card>
        <ThemedText type="sectionTitle">안내·약관</ThemedText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/info/safety')} style={styles.linkRow}>
          <ThemedText>금어기·출조 안전 정보</ThemedText>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} style={styles.linkRow}>
          <ThemedText>이용약관</ThemedText>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={styles.linkRow}>
          <ThemedText>개인정보 처리방침</ThemedText>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      </Card>

      <Card>
        <ThemedText type="sectionTitle">앱 정보</ThemedText>
        <ThemedText themeColor="textSecondary">버전 {Constants.expoConfig?.version ?? '-'}</ThemedText>
        {__DEV__ && (
          <ThemedText type="code" themeColor="textSecondary">
            {API_URL}
          </ThemedText>
        )}
      </Card>

      <DeleteAccount />
    </StackScreen>
  );
}

/** 접었다 펴는 칸 (설정 화면이 길어지지 않게 처음엔 제목만) */
function Fold({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.linkRow}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {hint && !open ? (
            <ThemedText type="small" themeColor="textSecondary">
              {hint}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText themeColor="textSecondary">{open ? '▴' : '▾'}</ThemedText>
      </Pressable>
      {open ? children : null}
    </Card>
  );
}

/** 회원 탈퇴 (로그인했을 때만, 설정 맨 아래). 앱 안에서 계정을 지울 수 있어야 한다 */
function DeleteAccount() {
  const { account, signOut } = useAuth();
  const qc = useQueryClient();
  if (!account) return null;
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
              router.dismissAll();
              Alert.alert('탈퇴했어요', '그동안 이용해 주셔서 감사합니다.');
            })
            .catch((e: Error) => Alert.alert('탈퇴하지 못했어요', e.message)),
      },
    ]);
  return (
    // 눈에 띄지 않게 맨 아래 작은 글씨 (경고는 누르면 뜨는 확인 창에)
    <Pressable accessibilityRole="button" onPress={confirmDelete} hitSlop={8} style={styles.deleteLink}>
      <ThemedText type="small" themeColor="textSecondary">
        회원 탈퇴
      </ThemedText>
    </Pressable>
  );
}

/** 차단한 사용자 (로그인했고 차단한 사람이 있을 때만). 풀면 그 사람의 글·댓글이 다시 보인다 */
function BlockedUsers() {
  const blocks = useBlocks();
  const unblock = useUnblock();
  if (!blocks.isSuccess || blocks.data.length === 0) return null;
  return (
    <Card>
      <ThemedText type="sectionTitle">차단한 사용자 {blocks.data.length}</ThemedText>
      {blocks.data.map((b) => (
        <View key={b.user_id} style={styles.row}>
          <ThemedText style={styles.flex}>{b.nickname}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${b.nickname} 차단 풀기`}
            hitSlop={8}
            style={styles.unblock}
            onPress={() =>
              Alert.alert(`${b.nickname}님 차단을 풀까요?`, '그 사람의 글·댓글이 다시 보여요.', [
                { text: '취소', style: 'cancel' },
                { text: '풀기', onPress: () => unblock.mutate(b.user_id) },
              ])
            }>
            <ThemedText type="smallBold" themeColor="tint">
              차단 풀기
            </ThemedText>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  unblock: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  flex: { flex: 1 },
  deleteLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  status: { fontWeight: '700', width: 30 },
});
