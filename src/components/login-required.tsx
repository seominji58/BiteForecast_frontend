import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { Card, Loading, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { useAuth } from '@/lib/auth';

/** 로그인이 필요한 화면·기능에서 보여주는 안내 카드 */
export function LoginRequired({
  title = '로그인이 필요해요',
  message,
  icon = 'write',
}: {
  title?: string;
  message: string;
  icon?: AppIconName;
}) {
  return (
    <Card style={styles.card}>
      <AppIcon name={icon} size={40} />
      <ThemedText type="sectionTitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {message}
      </ThemedText>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="회원가입"
            variant="secondary"
            onPress={() => router.push({ pathname: '/signup', params: { mode: 'email' } })}
          />
        </View>
        <View style={styles.flex}>
          <Button label="로그인" onPress={() => router.push('/login')} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 4 },
});

/**
 * 로그인했을 때만 children 을 그린다. 손님이면 안내 카드, 확인 중이면 로딩.
 * 화면 안쪽 훅(저장·조회)이 로그인 전에 실행되지 않도록 바깥에서 감싼다.
 */
export function AuthGate({
  message,
  icon,
  children,
}: {
  message: string;
  icon?: AppIconName;
  children: ReactNode;
}) {
  const { status } = useAuth();
  if (status === 'signed-in') return <>{children}</>;
  return <StackScreen>{status === 'loading' ? <Loading /> : <LoginRequired message={message} icon={icon} />}</StackScreen>;
}
