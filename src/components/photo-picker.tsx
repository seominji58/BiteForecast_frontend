import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Photo } from '@/api/types';
import { type PhotoPurpose, uploadPhoto, usePhotoSource } from '@/api/upload';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export const MAX_PHOTOS = 4;

type Item = {
  key: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  /** 새로 고른 사진의 기기 내 주소 (미리보기·재시도용) */
  local?: ImagePicker.ImagePickerAsset;
  /** 서버에 올라간 사진 */
  photo?: Photo;
  error?: string;
};

/** EXIF 「2026:11:01 06:30:00」 → ISO (기기 시간대 기준). 없거나 형식이 다르면 null */
function exifTime(asset: ImagePicker.ImagePickerAsset): string | null {
  const raw = asset.exif?.DateTimeOriginal ?? asset.exif?.['{Exif}']?.DateTimeOriginal;
  const m = typeof raw === 'string' ? raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}

/**
 * 사진 첨부 상태 (선택 → 즉시 업로드 → 진행률 → 실패 시 재시도). 저장할 때는 photoIds 만 서버로 보낸다.
 * 업로드 중이거나 실패한 사진이 있으면 저장 버튼을 막을 수 있도록 상태를 함께 내보낸다.
 */
export function usePhotoUploads(purpose: PhotoPurpose, initial: Photo[] = []) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((p) => ({ key: `s${p.id}`, status: 'done', progress: 1, photo: p })),
  );
  const seq = useRef(0);

  const patch = (key: string, v: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...v } : it)));

  const start = (key: string, asset: ImagePicker.ImagePickerAsset) => {
    patch(key, { status: 'uploading', progress: 0, error: undefined });
    uploadPhoto(asset, purpose, (r) => patch(key, { progress: r }), exifTime(asset))
      .then((photo) => patch(key, { status: 'done', progress: 1, photo }))
      .catch((e: Error) => patch(key, { status: 'error', error: e.message }));
  };

  const add = async () => {
    const remaining = MAX_PHOTOS - items.length;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      exif: true,
    });
    if (res.canceled) return;
    const assets = res.assets.slice(0, remaining);
    const added = assets.map((asset) => ({
      key: `n${++seq.current}`,
      status: 'uploading' as const,
      progress: 0,
      local: asset,
    }));
    setItems((list) => [...list, ...added]);
    added.forEach((it) => start(it.key, it.local));
  };

  const remove = (key: string) => setItems((list) => list.filter((it) => it.key !== key));
  const retry = (key: string) => {
    const it = items.find((x) => x.key === key);
    if (it?.local) start(key, it.local);
  };

  return {
    items,
    add,
    remove,
    retry,
    uploading: items.some((it) => it.status === 'uploading'),
    failed: items.some((it) => it.status === 'error'),
    photoIds: items.flatMap((it) => (it.status === 'done' && it.photo ? [it.photo.id] : [])),
  };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;

/** 사진 썸네일 줄: 미리보기 · ✕ 삭제 · 진행률 · 실패 시 「다시」 · ＋ 추가 (최대 4장) */
export function PhotoPicker({ state, disabled }: { state: PhotoUploads; disabled?: boolean }) {
  const theme = useTheme();
  const source = usePhotoSource();
  const full = state.items.length >= MAX_PHOTOS;

  const onAdd = () =>
    state.add().catch((e: Error) => Alert.alert('사진을 열 수 없어요', e.message || '사진 보관함 접근 권한을 확인해 주세요.'));

  return (
    <View style={styles.row}>
      {state.items.map((it) => {
        const src = it.local ? { uri: it.local.uri } : it.photo ? source(it.photo) : null;
        return (
          <View key={it.key} style={[styles.thumb, { borderColor: it.status === 'error' ? theme.danger : theme.border }]}>
            {src ? <Image source={src} style={styles.img} contentFit="cover" transition={120} /> : null}
            {it.status === 'uploading' ? (
              <View style={styles.overlay} accessibilityLabel={`업로드 중 ${Math.round(it.progress * 100)}%`}>
                <ActivityIndicator color="#fff" />
                <ThemedText type="smallBold" style={styles.overlayText}>
                  {Math.round(it.progress * 100)}%
                </ThemedText>
              </View>
            ) : null}
            {it.status === 'error' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`업로드 실패: ${it.error ?? ''}. 다시 시도`}
                onPress={() => state.retry(it.key)}
                style={[styles.overlay, styles.errorOverlay]}>
                <ThemedText type="smallBold" style={styles.overlayText}>
                  실패
                </ThemedText>
                <ThemedText type="small" style={styles.overlayText}>
                  눌러서 다시
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 빼기"
              hitSlop={8}
              onPress={() => state.remove(it.key)}
              style={styles.remove}>
              <ThemedText type="smallBold" style={styles.removeText}>
                ✕
              </ThemedText>
            </Pressable>
          </View>
        );
      })}
      {!full ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`사진 추가 (${state.items.length}/${MAX_PHOTOS})`}
          disabled={disabled}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.thumb,
            styles.add,
            { borderColor: theme.tint, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
          ]}>
          <ThemedText style={styles.plus} themeColor="tint">
            ＋
          </ThemedText>
          <ThemedText type="small" themeColor="tint">
            {state.items.length}/{MAX_PHOTOS}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const SIZE = 76;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: SIZE, height: SIZE, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,42,71,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  errorOverlay: { backgroundColor: 'rgba(198,40,40,0.7)' },
  overlayText: { color: '#fff' },
  remove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 11, lineHeight: 14 },
  add: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  plus: { fontSize: 24, lineHeight: 28 },
});
