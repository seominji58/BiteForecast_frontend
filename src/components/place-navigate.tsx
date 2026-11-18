/**
 * 낚시터 상세 「길안내」·「주소 공유」 (2026-11-19).
 * - 길안내: 카카오맵·네이버 지도·T맵 중 고르면 그 앱의 자동차 길안내로 바로 연다 (앱이 없으면 카카오맵 웹)
 * - 주소 공유: 시스템 공유창 (복사·메시지 보내기). 주소가 없으면 이름·지역을 보낸다
 * - 좌표가 신고 주소 기준(대략 위치)이면 「실제 낚시 자리와 다를 수 있어요」를 함께 쓴다
 */
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import type { Place } from '@/api/types';
import { Button } from '@/components/form';
import { OptionSheet } from '@/components/option-sheet';
import { ThemedText } from '@/components/themed-text';
import { NAV_APP_LABEL, type NavApp, navTarget, navUrls } from '@/lib/navigate';

export function PlaceNavigate({ place, name }: { place: Place; name: string }) {
  const [open, setOpen] = useState(false);
  const t = navTarget(place, name);
  const approx = t.kind === 'route' && (!place.coord || place.coord.approx || place.coord.grade === 'C');

  const go = async (app: NavApp) => {
    if (t.kind === 'none') return;
    const [appUrl, web] = navUrls(app, t);
    try {
      await Linking.openURL(appUrl);
    } catch {
      // 앱이 설치되어 있지 않으면 웹 지도로
      Linking.openURL(web).catch(() => {});
    }
  };
  const share = () =>
    Share.share({ message: [name, place.address ?? place.region_name].filter(Boolean).join('\n') }).catch(() => {});

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
      ) : approx ? (
        <ThemedText type="small" themeColor="textSecondary">
          신고된 주소 위치로 안내해요 · 실제 낚시 자리와 다를 수 있어요
        </ThemedText>
      ) : t.kind === 'search' ? (
        <ThemedText type="small" themeColor="textSecondary">
          위치 확인이 필요한 곳이라 경로 대신 주소로 검색해요
        </ThemedText>
      ) : null}
      <OptionSheet<NavApp>
        open={open}
        title={t.kind === 'route' ? '어느 앱으로 길안내할까요?' : '어느 지도에서 찾을까요?'}
        options={(Object.keys(NAV_APP_LABEL) as NavApp[]).map((a) => ({
          value: a,
          label: NAV_APP_LABEL[a],
          sub: a === 'kakao' ? '앱이 없으면 웹 지도로 열려요' : undefined,
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
});
