/**
 * 낚시터 위성 사진 (2026-11-18). 사진 자료가 없는 낚시터를 실제 위치 모습으로 보여준다.
 * - 서버 /places/{id}/map.jpg (네이버 클라우드 Static Map 대행, 키는 서버에만)
 * - 좌표가 없거나 의심(D등급)이면 엉뚱한 곳이 보이므로 사진 대신 낚시터 종류 그림
 * - 불러오지 못해도(서버 오류·오프라인) 같은 그림으로 대체 — 빈 칸이나 깨진 이미지를 두지 않는다
 * - 기기 디스크에 캐시 (서버 응답 Cache-Control 하루)
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { API_URL } from '@/api/client';
import { usePlacePhotoIndex, usePlacePhotos } from '@/api/queries';
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

/**
 * 목록·카드 썸네일 (2026-11-18): 관광공사 실제 사진이 있으면 그 사진, 없으면 낚시터 종류 그림.
 * 위성 사진은 신고 주소 좌표(C등급)라 실제 낚시 자리를 보여주지 못해 목록에서는 쓰지 않는다.
 * 공공누리 제3유형(변경 금지) → 자르지 않고 원본 비율로 담는다 (남는 칸은 배경색)
 */
export function PlaceThumb({ place, style }: { place: Pick<Place, 'id' | 'type'>; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const idx = usePlacePhotoIndex();
  const thumb = idx.data?.thumbs[String(place.id)];
  const [failed, setFailed] = useState(false);
  if (!thumb || failed) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.tintSoft }, style]}>
        <AppIcon name={PLACE_IMAGE[place.type]} size={26} />
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundSelected }, style]}>
      <Image
        source={{ uri: thumb }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        transition={150}
        onError={() => setFailed(true)}
        accessibilityLabel="낚시터 사진 (한국관광공사)"
      />
    </View>
  );
}

/**
 * 상세 맨 위 사진 (2026-11-18)
 * - 관광공사 실제 사진이 있으면 넘겨 보기 + 출처·공공누리 표시 (자르지 않음)
 * - 없으면 작은 위성 지도를 「위치 확인용」으로만 (신고 주소 좌표라 실제 낚시 자리와 다를 수 있음을 밝힌다)
 * - 좌표가 없거나 의심이면 아무것도 그리지 않는다
 */
export function PlaceGallery({ place, style }: { place: Place; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const photos = usePlacePhotos(place.id);
  const [page, setPage] = useState(0);
  const [w, setW] = useState(0);
  if (photos.data?.images.length) {
    const imgs = photos.data.images;
    return (
      <View style={style} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}>
          {imgs.map((im) => (
            <Image
              key={im.url}
              source={{ uri: im.url }}
              style={{ width: w || 1, aspectRatio: 4 / 3, backgroundColor: '#0B2D4D' }}
              contentFit="contain"
              cachePolicy="disk"
              transition={150}
              accessibilityLabel={`${photos.data!.title} 사진`}
            />
          ))}
        </ScrollView>
        {imgs.length > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.tagText}>
              {page + 1}/{imgs.length}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.credit, { color: theme.textSecondary }]} numberOfLines={1}>
          사진: {photos.data.source} · {photos.data.license}
        </Text>
      </View>
    );
  }
  if (photos.isPending || place.lat == null || place.location_suspect) return null;
  const caption = place.type === 'boat' || place.type === 'point' ? '기관 지정 대표 지점 위치' : '신고된 주소 위치 · 실제 낚시 자리와 다를 수 있어요';
  return (
    <View style={style}>
      <PlacePhoto place={place} size="hero" style={styles.locMap} label={`${place.name} 위치`} caption={caption} />
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(8,28,50,0.72)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  credit: { fontSize: 11, paddingHorizontal: 12, paddingTop: 6 },
  locMap: { width: '100%', aspectRatio: 2.6 },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  box: { overflow: 'hidden' },
  tag: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(8,28,50,0.72)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
