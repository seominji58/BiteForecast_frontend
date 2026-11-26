/**
 * 낚시터 위성 사진 (2026-11-18). 사진 자료가 없는 낚시터를 실제 위치 모습으로 보여준다.
 * - 서버 /places/{id}/map.jpg (네이버 클라우드 Static Map 대행, 키는 서버에만)
 * - 좌표가 없거나 의심(D등급)이면 엉뚱한 곳이 보이므로 사진 대신 낚시터 종류 그림
 * - 불러오지 못해도(서버 오류·오프라인) 같은 그림으로 대체 — 빈 칸이나 깨진 이미지를 두지 않는다
 * - 기기 디스크에 캐시 (서버 응답 Cache-Control 하루)
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/app-text';

import { API_URL } from '@/api/client';
import { usePlaceKakao, usePlacePhotoIndex, usePlacePhotos, usePosts } from '@/api/queries';
import type { Place } from '@/api/types';
import { usePhotoSource } from '@/api/upload';
import { timeAgo } from '@/lib/format';
import { AppIcon } from '@/components/app-icon';
import { useTheme } from '@/hooks/use-theme';
import { PLACE_IMAGE } from '@/lib/place';

type P = Pick<Place, 'id' | 'type' | 'lat' | 'lon' | 'location_suspect'>;

/**
 * 관광공사 사진을 서버가 줄인 사본으로 (2026-11-26). 갤러리 원본은 장당 ~1.2MB 라 폰에서 한참 회색이었다.
 * 서버 /tour-photo 가 긴 변 400·1000px 로 줄여 캐시한다. 관광공사 주소가 아니면 그대로
 */
export function tourPhoto(u: string, w: 400 | 1000): string {
  return /^https?:\/\/tong\.visitkorea\.or\.kr\//.test(u) ? `${API_URL}/tour-photo?u=${encodeURIComponent(u)}&w=${w}` : u;
}

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
      <View
        style={[styles.fallback, { backgroundColor: theme.tintSoft }, style]}
        accessibilityLabel={label ? `${label} (사진 없음)` : undefined}>
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
  // 0: 줄인 사본 → 1: 원본 → 2: 그림
  const [failed, setFailed] = useState(0);
  if (!thumb || failed >= 2) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.tintSoft }, style]}>
        <AppIcon name={PLACE_IMAGE[place.type]} size={26} />
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundSelected }, style]}>
      <Image
        source={{ uri: failed === 0 ? tourPhoto(thumb, 400) : thumb }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        transition={150}
        onError={() => setFailed((n) => n + 1)}
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
export function PlaceGallery({
  place,
  style,
  height,
  onPost,
}: {
  place: Place;
  style?: StyleProp<ViewStyle>;
  height?: number;
  /** 이용자 사진을 누르면 그 글로 (넘어가기 직전 호출). 안 주면 사진은 눌리지 않는다 (바깥이 「크게 보기」일 때) */
  onPost?: () => void;
}) {
  // height 를 주면 사진·지도를 그 높이로 맞춘다 (상세 상단 미리보기, 2026-11-23)
  const box = height ? { height } : { aspectRatio: 4 / 3 };
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
          {/* 원본이 장당 0.1~0.7MB라 한꺼번에 받으면 첫 장이 늦게 뜬다 (2026-11-26):
              지금 장과 바로 옆 장만 받고, 작은 미리보기가 있으면 먼저 보여 주고, 받는 동안 로딩 표시 */}
          {imgs.map((im, i) =>
            Math.abs(i - page) <= 1 ? (
              <GalleryImage
                key={im.url}
                url={im.url}
                thumb={im.thumb !== im.url ? im.thumb : undefined}
                first={i === page}
                style={{ width: w || 1, ...box }}
                label={`${photos.data!.title} 사진`}
              />
            ) : (
              <View key={im.url} style={{ width: w || 1, ...box, backgroundColor: '#0B2D4D' }} />
            ),
          )}
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
  if (photos.isPending) return null;
  return <UserPhotosOrMap place={place} style={style} height={height} onPost={onPost} />;
}

/** 갤러리 한 장: 받는 동안 가운데 로딩 표시, 작은 미리보기(thumb)가 있으면 먼저 흐리게 */
function GalleryImage({
  url,
  thumb,
  first,
  style,
  label,
}: {
  url: string;
  thumb?: string;
  first: boolean;
  style: StyleProp<ViewStyle>;
  label: string;
}) {
  const [loaded, setLoaded] = useState(false);
  // 줄인 사본(서버)을 먼저, 실패하면 원본으로
  const [raw, setRaw] = useState(false);
  return (
    <View style={[style, styles.galleryBox]}>
      <Image
        source={{ uri: raw ? url : tourPhoto(url, 1000) }}
        placeholder={{ uri: tourPhoto(thumb ?? url, 400) }}
        placeholderContentFit="contain"
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        priority={first ? 'high' : 'normal'}
        transition={150}
        onLoad={() => setLoaded(true)}
        onError={() => (raw ? setLoaded(true) : setRaw(true))}
        accessibilityLabel={label}
      />
      {loaded ? null : <ActivityIndicator color="#FFFFFF" style={styles.spinner} />}
    </View>
  );
}

/**
 * 관광공사 사진이 없으면: 이용자가 이 낚시터로 올린 글 사진 (낚시터 이름까지 공개한 글만, 신고 숨김·차단 제외는 서버 규칙)
 * → 그것도 없으면 위성 지도. 사진마다 「이용자 사진 · 닉네임 · 언제」를 쓰고, 누르면 그 글로 간다
 */
function UserPhotosOrMap({
  place,
  style,
  height,
  onPost,
}: {
  place: Place;
  style?: StyleProp<ViewStyle>;
  height?: number;
  onPost?: () => void;
}) {
  const box = height ? { height } : { aspectRatio: 4 / 3 };
  const theme = useTheme();
  const source = usePhotoSource();
  const posts = usePosts(null, 'latest', { placeId: place.id }, 20);
  const kakaoMoved = usePlaceKakao(place.id).data?.moved;
  const [page, setPage] = useState(0);
  const [w, setW] = useState(0);
  const withPhoto = (posts.data ?? []).filter((x) => x.thumb).slice(0, 8);
  if (posts.isPending) return null;
  if (withPhoto.length) {
    const cur = withPhoto[Math.min(page, withPhoto.length - 1)];
    return (
      <View style={style} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}>
          {withPhoto.map((x) => {
            const src = source(x.thumb!);
            return (
              <Pressable
                key={x.id}
                disabled={!onPost}
                accessibilityRole={onPost ? 'button' : 'image'}
                accessibilityLabel={`${x.author.nickname}님이 올린 사진${onPost ? ', 글 보기' : ''}`}
                onPress={() => {
                  onPost?.();
                  router.push({ pathname: '/community/[id]', params: { id: String(x.id) } });
                }}>
                {src ? (
                  <Image source={src} style={{ width: w || 1, ...box, backgroundColor: '#0B2D4D' }} contentFit="cover" transition={150} />
                ) : (
                  <View style={{ width: w || 1, ...box, backgroundColor: '#0B2D4D' }} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.counter}>
          <Text style={styles.tagText}>{withPhoto.length > 1 ? `이용자 사진 ${page + 1}/${withPhoto.length}` : '이용자 사진'}</Text>
        </View>
        <Text style={[styles.credit, { color: theme.textSecondary }]} numberOfLines={1}>
          이용자 사진 · {cur.author.nickname} · {timeAgo(cur.created_at)} · 누르면 글로 이동
        </Text>
      </View>
    );
  }
  if (place.lat == null || place.location_suspect) return null;
  const caption =
    place.type === 'boat' || place.type === 'point'
      ? '기관 지정 대표 지점 위치'
      : kakaoMoved
        ? '카카오맵 등록 위치 · 실제 낚시 자리와 다를 수 있어요'
        : '신고된 주소 위치 · 실제 낚시 자리와 다를 수 있어요';
  return (
    <View style={style}>
      <PlacePhoto
        place={place}
        size="hero"
        style={height ? { width: '100%', height } : styles.locMap}
        label={`${place.name} 위치`}
        caption={caption}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: 'rgba(8,28,50,0.72)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  credit: { fontSize: 11, paddingHorizontal: 12, paddingTop: 6 },
  locMap: { width: '100%', aspectRatio: 2.6 },
  galleryBox: { backgroundColor: '#0B2D4D', alignItems: 'center', justifyContent: 'center' },
  spinner: { position: 'absolute' },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  box: { overflow: 'hidden' },
  tag: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(8,28,50,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
