/**
 * 푸시 알림 (2026-11-25).
 * - 안드로이드만: FCM 토큰을 서버(/me/push/device)에 등록. iOS 는 애플 개발자 계정(APNs)이 생기면 연결
 * - 로그인했을 때만 등록하고, 로그아웃하면 이 폰을 서버에서 지운다
 * - 알림을 누르면 data.url 화면을 연다 (/place/12, /trip/3, /trips, /)
 * 알림 종류(즐겨찾기 좋음·출조 날 특보·이번 주 좋은 날)와 보내는 시각은 서버가 정한다 (backend services/push.py)
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/api';

export const PUSH_SUPPORTED = Platform.OS === 'android';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registered: string | null = null;

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function pushPermission(): Promise<PushPermission> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

/** 권한을 (처음이면) 묻고, 허락했으면 이 폰을 서버에 등록. 실패해도 조용히 넘긴다 */
export async function registerPush(ask: boolean): Promise<PushPermission> {
  if (!PUSH_SUPPORTED) return 'unsupported';
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: '낚시 알림',
      importance: AndroidImportance.DEFAULT,
    });
    let perm = await pushPermission();
    if (perm === 'undetermined' && ask) {
      perm = (await Notifications.requestPermissionsAsync()).granted ? 'granted' : await pushPermission();
    }
    if (perm !== 'granted') return perm;
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = String(data);
    if (__DEV__) console.log('[push] device token', token);
    await api.registerPushDevice(token, 'android');
    registered = token;
    return 'granted';
  } catch {
    return 'undetermined';
  }
}

/** 로그아웃 전: 이 폰에 더 보내지 않게 */
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  const token = registered;
  registered = null;
  await api.removePushDevice(token).catch(() => undefined);
}

const ALLOWED = /^\/(place\/\d+|trip\/\d+|trips)?$/;

function openFrom(n: Notifications.Notification | undefined) {
  const url = n?.request.content.data?.url;
  if (typeof url === 'string' && ALLOWED.test(url)) router.push(url as never);
}

/** 알림을 눌러 앱이 열리거나(꺼져 있던 상태 포함) 앞으로 오면 그 화면으로 */
export function listenPushTaps(): () => void {
  if (!PUSH_SUPPORTED) return () => undefined;
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    openFrom(last.notification);
    Notifications.clearLastNotificationResponse();
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => openFrom(r.notification));
  return () => sub.remove();
}
