/**
 * 어종 그림 (홈·전체 어종·도감·상세·출조계획 공통).
 * 그림이 없는 어종(목록에 없는 직접 입력 등)은 같은 그림체의 기본 실루엣(unknown_fish)으로 — 목록에서 빠지지 않는다.
 */
import { Image } from 'expo-image';

import { SPECIES_IMAGES } from '@/lib/species-images';

export function SpeciesImage({ code, size, label }: { code: string | null; size: number; label?: string }) {
  const src = code ? SPECIES_IMAGES[code] : undefined;
  return (
    <Image
      source={src ?? SPECIES_IMAGES.unknown_fish}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel={label ? `${label}${src ? ' 그림' : ' (기본 그림)'}` : undefined}
    />
  );
}
