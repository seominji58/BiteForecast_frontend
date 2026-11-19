/**
 * 낚시터 상세 「길안내」·「주소 공유」 (2026-11-19).
 * - 길안내: 카카오맵·네이버 지도·T맵 중 고르면 그 앱의 자동차 길안내로 바로 연다
 *   앱이 없으면 「설치하기」 또는 (iOS) 「Apple 지도로 열기」를 고르게 한다
 * - 주소 공유: 시스템 공유창 (복사·메시지 보내기). 주소가 없으면 이름·지역을 보낸다
 * - 좌표가 신고 주소 기준(대략 위치)이면 「실제 낚시 자리와 다를 수 있어요」를 함께 쓴다
 * - 카카오 장소와 매칭된 곳은 도로명 주소와 「카카오맵에서 사진·리뷰 보기」 링크를 보여준다 (사진은 카카오맵에서)
 */
import * as Device from 'expo-device';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { usePlaceKakao } from '@/api/queries';

import type { Place } from '@/api/types';
import { Button } from '@/components/form';
import { OptionSheet } from '@/components/option-sheet';
import { ThemedText } from '@/components/themed-text';
import { appleMapsUrl, NAV_APP_LABEL, NAV_STORE, type NavApp, navTarget, navUrl } from '@/lib/navigate';

export function PlaceNavigate({ place, name }: { place: Place; name: string }) {
  const [open, setOpen] = useState(false);
  const kakao = usePlaceKakao(place.id).data;
  const t = navTarget(place, name);
  const address = kakao?.road_address ?? place.address;
  const approx = t.kind === 'route' && (!place.coord || place.coord.approx || place.coord.grade === 'C');

  const go = async (app: NavApp) => {
    if (t.kind === 'none') return;
    try {
      await Linking.openURL(navUrl(app, t));
    } catch {
      // 앱이 없으면: 설치 또는 기기 기본 지도 (웹 길찾기는 「앱 설치」 안내만 떠서 쓰지 않는다)
      const label = NAV_APP_LABEL[app];
      const store = NAV_STORE[app][Platform.OS === 'ios' ? 0 : 1];
      Alert.alert(`${label} 앱이 없어요`, '설치하거나 다른 지도 앱으로 길안내를 받을 수 있어요.', [
        // 시뮬레이터에는 앱스토어가 없어 「주소가 유효하지 않음」만 뜨므로 실제 기기에서만 보여준다
        ...(Device.isDevice ? [{ text: `${label} 설치하기`, onPress: () => Linking.openURL(store).catch(() => {}) }] : []),
        ...(Platform.OS === 'ios'
          ? [{ text: 'Apple 지도로 열기', onPress: () => Linking.openURL(appleMapsUrl(t)).catch(() => {}) }]
          : []),
        { text: '다른 앱 고르기', onPress: () => setTimeout(() => setOpen(true), 300) },
        { text: '취소', style: 'cancel' as const },
      ]);
    }
  };
  const share = () =>
    Share.share({ message: [name, address ?? place.region_name].filter(Boolean).join('\n') }).catch(() => {});

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {t.kind !== 'none' ? (
          <View style={styles.flex}>
            <Button label={t.kind === 'route' ? '길안내' : '지도에서 주소 찾기'} variant="navy" onPress={() => setOpen(true)} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Button label="주소 공유" variant="secondary" onPress={share} />
        </View>
      </View>
      {t.kind === 'none' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t.reason}
        </ThemedText>
      ) : kakao && t.kind === 'route' ? (
        <ThemedText type="small" themeColor="textSecondary">
          카카오맵에 등록된 위치로 안내해요 · 실제 낚시 자리와 다를 수 있어요
        </ThemedText>
      ) : approx ? (
        <ThemedText type="small" themeColor="textSecondary">
          신고된 주소 위치로 안내해요 · 실제 낚시 자리와 다를 수 있어요
        </ThemedText>
      ) : t.kind === 'search' ? (
        <ThemedText type="small" themeColor="textSecondary">
          위치 확인이 필요한 곳이라 경로 대신 주소로 검색해요
        </ThemedText>
      ) : null}
      {kakao ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`카카오맵에서 ${kakao.name} 사진·리뷰 보기`}
          onPress={() => Linking.openURL(kakao.url).catch(() => {})}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" themeColor="tint">
              카카오맵에서 사진·리뷰 보기 ›
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {kakao.name} · {kakao.road_address}
            </ThemedText>
          </View>
        </Pressable>
      ) : null}
      <OptionSheet<NavApp>
        open={open}
        title={t.kind === 'route' ? '어느 앱으로 길안내할까요?' : '어느 지도에서 찾을까요?'}
        options={(Object.keys(NAV_APP_LABEL) as NavApp[]).map((a) => ({
          value: a,
          label: NAV_APP_LABEL[a],
        }))}
        value={null}
        onPick={go}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  link: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
