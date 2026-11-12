import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { api } from '@/api';
import type { TripInvitePreview } from '@/api/types';
import { Button, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { Card, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { periodLabel } from '@/lib/trip';

const CODE_LEN = 6;

/** 초대 코드로 참여: 코드 입력 → 어떤 계획인지 먼저 보여주고 → 참여 */
function JoinBody() {
  const qc = useQueryClient();
  const initial = useLocalSearchParams<{ code?: string }>().code ?? '';
  const [code, setCode] = useState(initial.toUpperCase());
  const [preview, setPreview] = useState<TripInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = code.trim().length === CODE_LEN;

  const check = (c: string) => {
    setBusy(true);
    setError(null);
    api
      .tripInvite(c.trim())
      .then(setPreview, (e: Error) => (setPreview(null), setError(e.message)))
      .finally(() => setBusy(false));
  };

  const open = (id: number) => router.replace({ pathname: '/trip/[id]', params: { id: String(id) } });
  const join = () => {
    setBusy(true);
    api.joinTrip(code.trim()).then(
      (t) => {
        qc.setQueryData(['trips', t.id], t);
        qc.invalidateQueries({ queryKey: ['trips', 'list'] });
        open(t.id);
      },
      (e: Error) => (setBusy(false), setError(e.message)),
    );
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: '초대 코드로 참여' }} />
      <Field label="친구에게 받은 초대 코드 (6자리)">
        <TextField
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/[^0-9a-zA-Z]/g, '').toUpperCase());
            setPreview(null);
            setError(null);
          }}
          placeholder="예: K7P2QX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_LEN}
          onSubmitEditing={() => ready && check(code)}
          returnKeyType="search"
          style={styles.code}
        />
      </Field>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      {!preview ? (
        <Button label="확인" disabled={!ready || busy} onPress={() => check(code)} />
      ) : (
        <Card style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {preview.owner_nickname}님의 출조 계획
          </ThemedText>
          <ThemedText type="sectionTitle">{preview.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {periodLabel(preview.start_date, preview.end_date)} · 함께 가는 사람 {preview.member_count}명
          </ThemedText>
          {preview.already ? (
            <Button label="이미 함께하는 계획이에요 · 열기" onPress={() => open(preview.trip_id)} />
          ) : (
            <Button label="참여하기" disabled={busy} onPress={join} />
          )}
          <ThemedText type="small" themeColor="textSecondary">
            참여하면 계획의 장소·해황·준비물을 함께 보고, 준비물 체크와 담당을 맡을 수 있어요. 내 닉네임이 참여자 목록에 보여요.
          </ThemedText>
        </Card>
      )}
    </StackScreen>
  );
}

export default function JoinTripScreen() {
  return (
    <AuthGate message="초대받은 계획에 참여하려면 로그인해 주세요." icon="trips">
      <JoinBody />
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 22, letterSpacing: 4, fontWeight: '700' },
  card: { gap: 8 },
});
