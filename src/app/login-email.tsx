import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { Button, Field, TextField } from '@/components/form';
import { StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

/** 이메일 로그인 (로그인 화면의 「이메일로 시작하기」에서 들어온다). 처음이면 아래 회원가입으로 */
export default function EmailLoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    if (!email.trim() || !password) return setError('이메일과 비밀번호를 입력해 주세요.');
    setBusy(true);
    setError(null);
    try {
      await signIn(await api.login({ email: email.trim(), password }));
      // 이 화면과 로그인 화면을 함께 닫고, 로그인을 시작한 화면으로 돌아간다
      if (router.canDismiss()) router.dismiss(2);
      else router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: '이메일 로그인' }} />
      <View style={styles.form}>
        <Field label="이메일">
          <TextField
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="you@example.com"
            autoFocus
          />
        </Field>
        <Field label="비밀번호">
          <TextField
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            placeholder="영문·숫자 8자 이상"
            onSubmitEditing={login}
            returnKeyType="go"
          />
        </Field>
        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
        <Button label={busy ? '로그인 중…' : '로그인'} onPress={login} disabled={busy} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/signup', params: { mode: 'email' } })}
          style={styles.signup}
          hitSlop={8}>
          <ThemedText themeColor="textSecondary">
            처음이신가요?{' '}
            <ThemedText type="smallBold" themeColor="tint">
              이메일로 회원가입
            </ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingTop: 8 },
  signup: { alignSelf: 'center', paddingVertical: 12, minHeight: 44 },
});
