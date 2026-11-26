/**
 * 앱 접근 권한 안내 (2026-11-26, 정보통신망법 제22조의2 — 원스토어 심사 대비).
 * 처음 켤 때 한 번: 앱이 쓰는 권한과 필수/선택, 쓰는 곳을 알린다. 실제 권한 요청은 그 기능을 쓸 때 따로 한다.
 * 필수 권한은 없다 (인터넷 접속은 고지 대상 아님). 설정 화면에서 다시 볼 수 있다.
 */
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { read, write } from '@/lib/prefs';

const KEY = 'biteforecast.permission_notice_v1';

export const PERMISSIONS: { icon: AppIconName; name: string; use: string }[] = [
  { icon: 'find-gps', name: '위치', use: '「내 주변」 낚시터 찾기, 탐험 도장 찍기 (위치는 폰 안에서만 쓰고 서버로 보내지 않아요)' },
  { icon: 'write', name: '카메라', use: '낚시 기록·글 사진 찍기, 사진으로 어종 찾기' },
  { icon: 'cat-catch', name: '사진', use: '앨범 사진 첨부, 사진으로 어종 찾기 (위치 정보는 지우고 올려요)' },
  { icon: 'tide', name: '알림', use: '출조 날 기상특보, 즐겨찾기 낚시터 「좋음」 알림' },
];

export function PermissionList() {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      <ThemedText type="smallBold">필수 접근 권한</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        없음
      </ThemedText>
      <ThemedText type="smallBold" style={styles.gap}>
        선택 접근 권한
      </ThemedText>
      {PERMISSIONS.map((p) => (
        <View key={p.name} style={[styles.row, { borderColor: theme.border }]}>
          <AppIcon name={p.icon} size={26} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{p.name} (선택)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {p.use}
            </ThemedText>
          </View>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        선택 권한은 허용하지 않아도 앱을 쓸 수 있어요. 그 기능을 처음 쓸 때 허용 여부를 물어보고, 휴대폰 설정 › 애플리케이션 › 입질예보 ›
        권한에서 언제든 바꿀 수 있어요.
      </ThemedText>
    </View>
  );
}

/** 처음 실행 때 한 번만 보이는 안내 (확인을 누르면 다시 안 보임) */
export function PermissionNotice() {
  const theme = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    read(KEY)
      .then((v) => setShow(!v))
      .catch(() => setShow(false));
  }, []);
  const close = () => {
    setShow(false);
    write(KEY, '1').catch(() => undefined);
  };
  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={styles.inner}>
            <ThemedText type="sectionTitle">앱 접근 권한 안내</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              입질예보는 아래 기능을 쓸 때만 권한을 요청해요.
            </ThemedText>
            <PermissionList />
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={close} style={styles.ok}>
            <ThemedText type="smallBold" style={styles.okText}>
              확인
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  box: { borderRadius: 16, maxHeight: '85%', overflow: 'hidden' },
  inner: { padding: 20, gap: 10 },
  list: { gap: 8 },
  gap: { marginTop: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  ok: { backgroundColor: Brand.navy, paddingVertical: 14, alignItems: 'center' },
  okText: { color: '#FFFFFF' },
});
