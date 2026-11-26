/**
 * 길안내 앱 고르기 (카카오맵·네이버 지도·T맵) — 낚시터 상세와 갯바위 참고 포인트가 같이 쓴다 (2026-11-20 분리).
 * - 고른 앱의 자동차 길안내로 바로 연다
 * - 앱이 없으면 「설치하기」(실제 기기만) 또는 (iOS) 「Apple 지도로 열기」·「다른 앱 고르기」
 */
import * as Device from 'expo-device';
import { useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { appleMapsUrl, NAV_APP_LABEL, NAV_STORE_IOS, type NavApp, type NavTarget, navUrl, webMapUrl } from '@/lib/navigate';

export function useNavPicker(t: NavTarget) {
  const [open, setOpen] = useState(false);

  const go = async (app: NavApp) => {
    if (t.kind === 'none') return;
    try {
      await Linking.openURL(navUrl(app, t));
    } catch {
      // 앱이 없으면: (iOS) 앱스토어 설치·Apple 지도 / (안드로이드) 웹 지도 — 원스토어 앱이라 구글 플레이로 보내지 않는다
      const label = NAV_APP_LABEL[app];
      const ios = Platform.OS === 'ios';
      Alert.alert(
        `${label} 앱이 없어요`,
        ios ? '설치하거나 다른 지도 앱으로 길안내를 받을 수 있어요.' : '웹 지도로 위치를 보거나 다른 지도 앱을 고를 수 있어요.',
        [
          // 시뮬레이터에는 앱스토어가 없어 「주소가 유효하지 않음」만 뜨므로 실제 기기에서만 보여준다
          ...(ios && Device.isDevice
            ? [{ text: `${label} 설치하기`, onPress: () => Linking.openURL(NAV_STORE_IOS[app]).catch(() => {}) }]
            : []),
          ...(ios
            ? [{ text: 'Apple 지도로 열기', onPress: () => Linking.openURL(appleMapsUrl(t)).catch(() => {}) }]
            : [{ text: '웹 지도로 보기', onPress: () => Linking.openURL(webMapUrl(t)).catch(() => {}) }]),
          { text: '다른 앱 고르기', onPress: () => setTimeout(() => setOpen(true), 300) },
          { text: '취소', style: 'cancel' as const },
        ],
      );
    }
  };

  const sheet = (
    <OptionSheet<NavApp>
      open={open}
      title={t.kind === 'route' ? '어느 앱으로 길안내할까요?' : '어느 지도에서 찾을까요?'}
      options={(Object.keys(NAV_APP_LABEL) as NavApp[]).map((a) => ({ value: a, label: NAV_APP_LABEL[a] }))}
      value={null}
      onPick={go}
      onClose={() => setOpen(false)}
    />
  );
  return { open: () => setOpen(true), sheet };
}
