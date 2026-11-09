import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import type { Agreements } from '@/api/types';
import { Button, Field, TextField } from '@/components/form';
import { Card, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { pendingGoogle } from '@/lib/google';

const NICK_RE = /^[0-9A-Za-z가-힣_]{2,12}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * 회원가입. mode=email: 이메일·비밀번호·닉네임·약관 / mode=google: 구글 계정 확인 후 닉네임·약관만.
 * 이 기기에서 로그인 없이 쓰던 기록은 가입한 계정에 그대로 이어진다.
 */
export default function SignupScreen() {
  const mode = useLocalSearchParams<{ mode?: string }>().mode === 'google' ? 'google' : 'email';
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [nickname, setNickname] = useState(mode === 'google' ? suggestNick(pendingGoogle.name) : '');
  const [nickMsg, setNickMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [agree, setAgree] = useState<Agreements>({ over_14: false, terms: false, privacy: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAgreed = agree.over_14 && agree.terms && agree.privacy;

  const checkNick = async () => {
    const n = nickname.trim();
    if (!n) return setNickMsg(null);
    if (!NICK_RE.test(n)) return setNickMsg({ ok: false, text: '2~12자의 한글·영문·숫자·밑줄(_)만 쓸 수 있어요' });
    try {
      const r = await api.nicknameCheck(n);
      setNickMsg(r.available ? { ok: true, text: '쓸 수 있는 닉네임이에요' } : { ok: false, text: r.message ?? '쓸 수 없어요' });
    } catch {
      setNickMsg(null);
    }
  };

  const submit = async () => {
    const n = nickname.trim();
    if (mode === 'email') {
      if (!EMAIL_RE.test(email.trim())) return setError('이메일 형식이 올바르지 않아요.');
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        return setError('비밀번호는 영문과 숫자를 섞어 8자 이상으로 만들어 주세요.');
      if (password !== password2) return setError('비밀번호 확인이 일치하지 않아요.');
    }
    if (!NICK_RE.test(n)) return setError('닉네임은 2~12자의 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.');
    if (!allAgreed) return setError('필수 항목에 모두 동의해 주세요.');
    if (mode === 'google' && !pendingGoogle.idToken) return setError('구글 로그인부터 다시 해 주세요.');
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === 'google'
          ? await api.googleSignup({ id_token: pendingGoogle.idToken!, nickname: n, agreements: agree })
          : await api.signup({ email: email.trim(), password, nickname: n, agreements: agree });
      Object.assign(pendingGoogle, { idToken: null, email: null, name: null });
      await signIn(res);
      router.dismissAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: mode === 'google' ? '구글 계정으로 가입' : '이메일로 회원가입' }} />

      {mode === 'google' ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            구글 계정
          </ThemedText>
          <ThemedText type="smallBold">{pendingGoogle.email ?? '이메일 비공개 계정'}</ThemedText>
        </Card>
      ) : (
        <>
          <Field label="이메일" required>
            <TextField
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="비밀번호" required>
            <TextField
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              placeholder="영문·숫자 섞어 8자 이상"
            />
          </Field>
          <Field label="비밀번호 확인" required>
            <TextField value={password2} onChangeText={setPassword2} secureTextEntry textContentType="newPassword" />
          </Field>
        </>
      )}

      <Field label="닉네임" required>
        <TextField
          value={nickname}
          onChangeText={(v) => {
            setNickname(v);
            setNickMsg(null);
          }}
          onBlur={checkNick}
          maxLength={12}
          autoCapitalize="none"
          placeholder="커뮤니티에 보이는 이름 (2~12자)"
        />
        {nickMsg ? (
          <ThemedText type="small" themeColor={nickMsg.ok ? 'success' : 'danger'}>
            {nickMsg.text}
          </ThemedText>
        ) : null}
      </Field>

      <Card>
        <Check
          label="전체 동의"
          bold
          value={allAgreed}
          onChange={(v) => setAgree({ over_14: v, terms: v, privacy: v })}
        />
        <View style={styles.sep} />
        <Check label="(필수) 만 14세 이상이에요" value={agree.over_14} onChange={(v) => setAgree({ ...agree, over_14: v })} />
        <Check
          label="(필수) 이용약관 동의"
          value={agree.terms}
          onChange={(v) => setAgree({ ...agree, terms: v })}
          onView={() => router.push('/terms')}
        />
        <Check
          label="(필수) 개인정보 수집·이용 동의"
          value={agree.privacy}
          onChange={(v) => setAgree({ ...agree, privacy: v })}
          onView={() => router.push('/privacy')}
        />
      </Card>

      {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
      <Button label={busy ? '가입 중…' : '가입하기'} onPress={submit} disabled={busy} />
      <ThemedText type="small" themeColor="textSecondary">
        이 기기에서 로그인 없이 남긴 기록이 있으면 가입한 계정으로 그대로 이어져요.
      </ThemedText>
    </StackScreen>
  );
}

function suggestNick(name: string | null): string {
  const n = (name ?? '').replace(/[^0-9A-Za-z가-힣_]/g, '').slice(0, 12);
  return n.length >= 2 ? n : '';
}

function Check({
  label,
  value,
  onChange,
  onView,
  bold,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onView?: () => void;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.checkRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        onPress={() => onChange(!value)}
        hitSlop={6}
        style={styles.checkPress}>
        <View
          style={[
            styles.box,
            { borderColor: value ? theme.tint : theme.backgroundSelected, backgroundColor: value ? theme.tint : 'transparent' },
          ]}>
          {value ? <ThemedText style={styles.tick}>✓</ThemedText> : null}
        </View>
        <ThemedText type={bold ? 'smallBold' : 'small'} style={styles.flex}>
          {label}
        </ThemedText>
      </Pressable>
      {onView ? (
        <Pressable accessibilityRole="link" onPress={onView} hitSlop={8}>
          <ThemedText type="small" themeColor="tint">
            보기
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#D8DEE6' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '800' },
});
