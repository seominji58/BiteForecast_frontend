import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api';
import { useAuthConfig } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { Button, Field, TextField } from '@/components/form';
import { StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { googleAvailable, googleIdToken, pendingGoogle } from '@/lib/google';

/**
 * 로그인 (2026-11-09 결정: 구글 + 이메일). 해황 보기는 로그인 없이 되고,
 * 기록·사진 인증·포인트·글쓰기·댓글·좋아요·신고는 로그인 후 쓸 수 있다.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const config = useAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 서버에 구글 클라이언트 ID 가 있고, 이 앱 빌드에 구글 모듈이 있을 때만 버튼을 보인다
  const showGoogle = config.data?.google && googleAvailable();

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const loginEmail = async () => {
    if (!email.trim() || !password) return setError('이메일과 비밀번호를 입력해 주세요.');
    setBusy('email');
    setError(null);
    try {
      await signIn(await api.login({ email: email.trim(), password }));
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loginGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      const idToken = await googleIdToken();
      if (!idToken) return; // 사용자가 취소
      const res = await api.google(idToken);
      if (res.status === 'signup_required') {
        Object.assign(pendingGoogle, { idToken, email: res.email, name: res.name });
        router.push({ pathname: '/signup', params: { mode: 'google' } });
        return;
      }
      await signIn(res);
      done();
    } catch (e) {
      Alert.alert('구글 로그인 실패', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <StackScreen>
      <View style={styles.head}>
        <AppIcon name="fishing-index" size={48} />
        <ThemedText type="sectionTitle">입질예보에 오신 걸 환영해요</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          해황 보기는 로그인 없이 쓸 수 있어요.{'\n'}낚시 기록·사진 인증·포인트·커뮤니티 글쓰기는 로그인이 필요해요.
        </ThemedText>
      </View>

      {showGoogle ? (
        <Pressable
          accessibilityRole="button"
          onPress={loginGoogle}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.google,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
            (pressed || busy !== null) && styles.dim,
          ]}>
          {busy === 'google' ? <ActivityIndicator /> : <ThemedText style={styles.gMark}>G</ThemedText>}
          <ThemedText type="smallBold">구글로 계속하기</ThemedText>
        </Pressable>
      ) : null}
      {!showGoogle && __DEV__ ? (
        <ThemedText type="small" themeColor="textSecondary">
          (개발 안내) 구글 로그인은 구글 클라이언트 ID 설정 후 개발용 앱에서 보여요. 실행 가이드 참고.
        </ThemedText>
      ) : null}

      {showGoogle ? (
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: theme.border }]} />
          <ThemedText type="small" themeColor="textSecondary">
            또는 이메일로
          </ThemedText>
          <View style={[styles.line, { backgroundColor: theme.border }]} />
        </View>
      ) : null}

      <Field label="이메일">
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
      <Field label="비밀번호">
        <TextField
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          placeholder="영문·숫자 8자 이상"
          onSubmitEditing={loginEmail}
          returnKeyType="go"
        />
      </Field>
      {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
      <Button label={busy === 'email' ? '로그인 중…' : '로그인'} onPress={loginEmail} disabled={busy !== null} />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/signup', params: { mode: 'email' } })}
        style={styles.signup}
        hitSlop={8}>
        <ThemedText type="small" themeColor="textSecondary">
          아직 회원이 아니신가요?{' '}
          <ThemedText type="smallBold" themeColor="tint">
            이메일로 회원가입
          </ThemedText>
        </ThemedText>
      </Pressable>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  center: { textAlign: 'center' },
  dim: { opacity: 0.6 },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  gMark: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  signup: { alignSelf: 'center', paddingVertical: 8 },
});
