import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Button, Field, TextField } from '@/components/form';
import { AuthGate } from '@/components/login-required';
import { StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

// 서버 규칙과 같다 (schemas/auth.py NICKNAME_RE): 2~12자 한글·영문·숫자·밑줄
const NICK_RE = /^[0-9A-Za-z가-힣_]{2,12}$/;

/** 닉네임 변경 (내정보 → 프로필 「닉네임 변경」). 글·댓글 작성자 이름도 함께 바뀐다 */
function Body() {
  const { account, setAccount } = useAuth();
  const [nickname, setNickname] = useState(account?.nickname ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const n = nickname.trim();
  const unchanged = n === account?.nickname;

  const check = async () => {
    if (!NICK_RE.test(n)) return setMsg({ ok: false, text: '닉네임은 2~12자의 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.' });
    const r = await api.nicknameCheck(n).catch((e: Error) => ({ available: false, message: e.message }));
    setMsg(r.available ? { ok: true, text: '쓸 수 있는 닉네임이에요.' } : { ok: false, text: r.message ?? '이미 쓰고 있는 닉네임이에요.' });
  };

  const save = async () => {
    if (!NICK_RE.test(n)) return setMsg({ ok: false, text: '닉네임은 2~12자의 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.' });
    setBusy(true);
    try {
      setAccount(await api.updateNickname(n));
      router.back();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="닉네임">
        <TextField
          value={nickname}
          onChangeText={(v) => {
            setNickname(v);
            setMsg(null);
          }}
          onBlur={() => n && !unchanged && check()}
          maxLength={12}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          placeholder="2~12자 한글·영문·숫자·밑줄"
        />
      </Field>
      {msg ? <ThemedText themeColor={msg.ok ? 'success' : 'danger'}>{msg.text}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        커뮤니티 글·댓글에 보이는 이름이에요. 바꾸면 예전에 쓴 글에도 새 닉네임이 보여요.
      </ThemedText>
      <Button label={busy ? '저장 중…' : '저장'} onPress={save} disabled={busy || unchanged || !n} />
    </View>
  );
}

export default function ProfileEditScreen() {
  return (
    <AuthGate message="닉네임 변경은 로그인 후 할 수 있어요." icon="write">
      <StackScreen>
        <Stack.Screen options={{ title: '닉네임 변경' }} />
        <Body />
      </StackScreen>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingTop: 8 },
});
