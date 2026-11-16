import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, type ColorValue } from 'react-native';

import { api } from '@/api';
import { useAuthConfig } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { googleAvailable, googleIdToken, pendingGoogle } from '@/lib/google';
import { kakaoAvailable, kakaoIdToken, pendingKakao } from '@/lib/kakao';

/**
 * 로그인 (2026-11-16): 버튼 3개 — 카카오 · 구글 · 이메일. 이메일은 다음 화면(/login-email)에서 입력한다.
 * 해황 보기는 로그인 없이 되고, 기록·사진 인증·포인트·글쓰기·댓글·좋아요·신고는 로그인 후 쓸 수 있다.
 * 카카오·구글은 서버 설정과 이 앱 빌드의 네이티브 모듈이 모두 있을 때만 보인다 (Expo Go 에서는 이메일만).
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const config = useAuthConfig();
  const [busy, setBusy] = useState<'google' | 'kakao' | null>(null);

  const showKakao = !!config.data?.kakao && kakaoAvailable();
  const showGoogle = !!config.data?.google && googleAvailable();

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const loginKakao = async () => {
    setBusy('kakao');
    try {
      const { nonce } = await api.authNonce();
      const idToken = await kakaoIdToken(nonce);
      if (!idToken) return; // 사용자가 취소
      const res = await api.social('kakao', { token: idToken, nonce });
      if (res.status === 'signup_required') {
        Object.assign(pendingKakao, { idToken, nonce, name: res.name });
        router.push({ pathname: '/signup', params: { mode: 'kakao' } });
        return;
      }
      await signIn(res);
      done();
    } catch (e) {
      Alert.alert('카카오 로그인 실패', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loginGoogle = async () => {
    setBusy('google');
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
        <AppIcon name="fishing-index" size={64} />
        <ThemedText type="subtitle" style={styles.brand}>
          입질예보
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          기록·사진 인증·커뮤니티는{'\n'}로그인하고 쓸 수 있어요
        </ThemedText>
      </View>

      <View style={styles.buttons}>
        {showKakao ? (
          <LoginButton
            label="카카오로 시작하기"
            // 카카오 디자인 가이드: 노랑 #FEE500, 말풍선 심볼·글자 검정
            bg="#FEE500"
            fg="rgba(0,0,0,0.85)"
            icon={<Ionicons name="chatbubble" size={22} color="#000" />}
            busy={busy === 'kakao'}
            disabled={busy !== null}
            onPress={loginKakao}
          />
        ) : null}
        {showGoogle ? (
          <LoginButton
            label="구글로 시작하기"
            bg="#FFFFFF"
            fg="#1F1F1F"
            border="#DADCE0"
            icon={<Ionicons name="logo-google" size={20} color="#4285F4" />}
            busy={busy === 'google'}
            disabled={busy !== null}
            onPress={loginGoogle}
          />
        ) : null}
        <LoginButton
          label="이메일로 시작하기"
          bg={Brand.navy}
          fg={Brand.onNavy}
          icon={<Ionicons name="mail" size={20} color={Brand.onNavy} />}
          disabled={busy !== null}
          onPress={() => router.push('/login-email')}
        />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        해황·물때 보기는 로그인 없이 쓸 수 있어요
      </ThemedText>
      {!showKakao && !showGoogle && __DEV__ ? (
        <ThemedText type="small" themeColor="textSecondary" style={[styles.center, { color: theme.textSecondary }]}>
          (개발 안내) 카카오·구글은 키 설정 후 개발용 앱(Expo Go 아님)에서 보여요
        </ThemedText>
      ) : null}
    </StackScreen>
  );
}

function LoginButton({
  label,
  bg,
  fg,
  border,
  icon,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  bg: ColorValue;
  fg: ColorValue;
  border?: ColorValue;
  icon: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border ?? bg },
        (pressed || (disabled && !busy)) && styles.dim,
      ]}>
      <View style={styles.icon}>{busy ? <ActivityIndicator color={fg as string} /> : icon}</View>
      <ThemedText type="sectionTitle" style={[styles.label, { color: fg }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8, paddingTop: 48, paddingBottom: 40 },
  brand: { fontWeight: '800' },
  center: { textAlign: 'center' },
  buttons: { gap: 12, marginBottom: 20 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 56,
  },
  // 아이콘은 왼쪽에 고정, 글자는 가운데 (세 버튼이 같은 모양으로 보이게)
  icon: { position: 'absolute', left: 20, width: 24, alignItems: 'center' },
  label: { fontWeight: '700' },
  dim: { opacity: 0.6 },
});
