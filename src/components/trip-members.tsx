/** 함께 가는 출조 (확장 기능 설계 1단계): 참여자 목록 · 초대 코드 · 내 참여 상태 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import type { MemberStatus, Trip, TripInvite, TripMember } from '@/api/types';
import { Button, Chip } from '@/components/form';
import { Card, SectionHeader } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { periodLabel } from '@/lib/trip';

export const STATUS_LABEL: Record<MemberStatus, string> = { joined: '참여', maybe: '미정', declined: '불참' };

/** 담당을 맡을 수 있는 사람: 만든 사람 + 참여·미정 */
export function participants(trip: Trip): TripMember[] {
  return trip.members.filter((m) => m.status !== 'declined');
}

export function ownerName(trip: Trip): string | null {
  return trip.members.find((m) => m.role === 'owner')?.nickname ?? null;
}

function expiresLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지`;
}

export function TripMembers({ trip, run }: { trip: Trip; run: (fn: () => Promise<Trip>) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [invite, setInvite] = useState<TripInvite | null>(null);
  const owner = trip.my_role === 'owner';
  const me = trip.members.find((m) => m.mine);
  const going = participants(trip).length;
  const fail = (e: Error) => Alert.alert('처리하지 못했어요', e.message);
  const refresh = () => qc.invalidateQueries({ queryKey: ['trips'] });

  const openInvite = () => api.createTripInvite(trip.id).then(setInvite, fail);
  const share = (i: TripInvite) =>
    Share.share({
      message:
        `[입질예보] 「${trip.title}」 출조에 함께 가요\n${periodLabel(trip.start_date, trip.end_date)}\n` +
        `초대 코드: ${i.code} (${expiresLabel(i.expires_at)})\n앱 › 출조계획 › 「초대 코드로 참여」에 입력하세요.`,
    });
  const revoke = () =>
    Alert.alert('초대 코드를 끌까요?', '이미 참여한 사람은 그대로 남아요. 다시 초대하면 새 코드가 만들어져요.', [
      { text: '취소', style: 'cancel' },
      { text: '끄기', style: 'destructive', onPress: () => api.revokeTripInvite(trip.id).then(() => setInvite(null), fail) },
    ]);
  const remove = (m: TripMember) =>
    Alert.alert(`${m.nickname}님을 계획에서 뺄까요?`, '맡은 준비물 담당도 풀려요.', [
      { text: '취소', style: 'cancel' },
      { text: '빼기', style: 'destructive', onPress: () => api.removeTripMember(trip.id, m.user_id).then(refresh, fail) },
    ]);
  const leave = () =>
    Alert.alert('이 계획에서 나갈까요?', '다시 들어오려면 초대 코드가 필요해요. 남긴 기록은 지워지지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: () =>
          api.removeTripMember(trip.id, me!.user_id).then(() => {
            refresh();
            router.back();
          }, fail),
      },
    ]);

  return (
    <>
      <SectionHeader title={`함께 가는 사람 ${going}명`} />
      <Card style={styles.card}>
        {trip.members.map((m) => (
          <View key={m.user_id} style={styles.row}>
            <ThemedText style={styles.flex} themeColor={m.status === 'declined' ? 'textSecondary' : 'text'} numberOfLines={1}>
              {m.nickname}
              {m.mine ? ' (나)' : ''}
            </ThemedText>
            <View style={[styles.badge, { backgroundColor: m.role === 'owner' ? theme.tintSoft : theme.background }]}>
              <ThemedText type="small" themeColor={m.status === 'joined' ? 'tint' : 'textSecondary'}>
                {m.role === 'owner' ? '만든 사람' : STATUS_LABEL[m.status]}
              </ThemedText>
            </View>
            {owner && m.role === 'member' ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`${m.nickname} 빼기`} hitSlop={8} onPress={() => remove(m)} style={styles.x}>
                <ThemedText themeColor="textSecondary">✕</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))}

        {owner ? (
          invite ? (
            <View style={[styles.invite, { backgroundColor: theme.background }]}>
              <ThemedText type="small" themeColor="textSecondary">
                초대 코드 · {expiresLabel(invite.expires_at)}
              </ThemedText>
              <ThemedText style={styles.code} selectable accessibilityLabel={`초대 코드 ${invite.code.split('').join(' ')}`}>
                {invite.code}
              </ThemedText>
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button label="코드 보내기" onPress={() => share(invite)} />
                </View>
                <View style={styles.flex}>
                  <Button label="초대 끄기" variant="secondary" onPress={revoke} />
                </View>
              </View>
            </View>
          ) : (
            <Button label="친구 초대" variant="secondary" onPress={openInvite} />
          )
        ) : me ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              내 참여 상태
            </ThemedText>
            <View style={styles.actions}>
              {(['joined', 'maybe', 'declined'] as const).map((s) => (
                <Chip
                  key={s}
                  label={STATUS_LABEL[s]}
                  selected={me.status === s}
                  onPress={() => me.status !== s && run(() => api.setMyTripStatus(trip.id, s))}
                />
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={leave} style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                이 계획에서 나가기
              </ThemedText>
            </Pressable>
          </>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  leave: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  x: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 },
  invite: { borderRadius: 10, padding: 12, gap: 6, alignItems: 'center' },
  code: { fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', flexWrap: 'wrap' },
});
