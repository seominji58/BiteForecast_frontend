/**
 * 사진 고르기: 「카메라로 찍기」 / 「앨범에서 고르기」 (2026-11-26 친구 테스트 — 카메라가 안 돼 불편).
 * 기록 사진·글 사진·사진으로 어종 찾기가 같이 쓴다. 취소하면 빈 배열
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

type Opts = { limit?: number; title?: string };

function choose(title: string): Promise<'camera' | 'library' | null> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      undefined,
      [
        { text: '카메라로 찍기', onPress: () => resolve('camera') },
        { text: '앨범에서 고르기', onPress: () => resolve('library') },
        { text: '취소', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export async function pickPhotos({ limit = 1, title = '사진 추가' }: Opts = {}): Promise<ImagePicker.ImagePickerAsset[]> {
  const how = await choose(title);
  if (!how) return [];
  if (how === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('카메라 권한', '카메라를 쓰려면 휴대폰 설정에서 카메라 권한을 허용해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings() },
      ]);
      return [];
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: true });
    return res.canceled ? [] : res.assets.slice(0, 1);
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
    exif: true,
  });
  return res.canceled ? [] : res.assets.slice(0, limit);
}
