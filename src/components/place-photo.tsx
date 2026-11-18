/**
 * 낚시터 위성 사진 (2026-11-18). 사진 자료가 없는 낚시터를 실제 위치 모습으로 보여준다.
 * - 서버 /places/{id}/map.jpg (네이버 클라우드 Static Map 대행, 키는 서버에만)
 * - 좌표가 없거나 의심(D등급)이면 엉뚱한 곳이 보이므로 사진 대신 낚시터 종류 그림
 * - 불러오지 못해도(서버 오류·오프라인) 같은 그림으로 대체 — 빈 칸이나 깨진 이미지를 두지 않는다
 * - 기기 디스크에 캐시 (서버 응답 Cache-Control 하루)
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { API_URL } from '@/api/client';
import type { Place } from '@/api/types';
import { AppIcon } from '@/components/app-icon';
import { useTheme } from '@/hooks/use-theme';
import { PLACE_IMAGE } from '@/lib/place';

type P = Pick<Place, 'id' | 'type' | 'lat' | 'lon' | 'location_suspect'>;

export function placePhotoUrl(p: P, size: 'hero' | 'thumb'): string | null {
  if (p.lat == null || p.lon == null || p.location_suspect) return null;
  return `${API_URL}/places/${p.id}/map.jpg?size=${size}`;
}

export function PlacePhoto({
  place,
  size,
  style,
  label,
  caption,
}: {
  place: P;
  size: 'hero' | 'thumb';
  style?: StyleProp<ViewStyle>;
  /** 화면 읽기용 (예: 「대부도바다낚시터 위성 사진」) */
  label?: string;
  /** 사진이 실제로 떴을 때만 왼쪽 아래에 붙이는 꼬리표 (대체 그림에는 붙이지 않는다) */
  caption?: string;
}) {
  const theme = useTheme();
  const url = placePhotoUrl(place, size);
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.tintSoft }, style]} accessibilityLabel={label ? `${label} (사진 없음)` : undefined}>
        <AppIcon name={PLACE_IMAGE[place.type]} size={size === 'hero' ? 56 : 26} />
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: theme.tintSoft }, style]}>
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        transition={150}
        onError={() => setFailed(true)}
        accessibilityLabel={label ? `${label} 위성 사진` : undefined}
      />
      {caption ? (
        <View style={styles.tag}>
          <Text style={styles.tagText} maxFontSizeMultiplier={1.2}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  box: { overflow: 'hidden' },
  tag: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(8,28,50,0.72)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
