import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlaces } from '@/api/queries';
import { AppIcon } from '@/components/app-icon';
import { PlacePicker } from '@/components/place-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLACE_IMAGE, PLACE_TYPE_LABEL } from '@/lib/place';

/**
 * 폼에서 쓰는 낚시터 선택 칸 (UX 검토 P0-4). 칩 수백 개 대신 공용 선택기(검색·최근·시도)를 연다.
 */
export function PlaceField({
  value,
  onChange,
  placeholder = '낚시터 선택',
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
}) {
  const places = usePlaces();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const place = places.data?.find((p) => p.id === value) ?? null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={place ? `낚시터: ${place.name}, 바꾸기` : placeholder}
        onPress={() => setOpen(true)}
        style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
        {place ? <AppIcon name={PLACE_IMAGE[place.type]} size={28} /> : null}
        <View style={styles.flex}>
          <ThemedText type={place ? 'smallBold' : 'default'} themeColor={place ? 'text' : 'textSecondary'}>
            {place ? place.name : placeholder}
          </ThemedText>
          {place ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {place.region_name} · {PLACE_TYPE_LABEL[place.type]}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="tint">
          {place ? '바꾸기' : '찾기'}
        </ThemedText>
      </Pressable>
      <PlacePicker
        visible={open}
        title="낚시터 선택"
        selectedId={value}
        onSelect={(p) => onChange(p.id)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
});
