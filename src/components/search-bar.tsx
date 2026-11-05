import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 돋보기 (아이콘 라이브러리 없이 원과 손잡이 도형으로 그림) */
export function Magnifier({ color, size = 18 }: { color: string; size?: number }) {
  const ring = size * 0.68;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: size * 0.12, borderColor: color }} />
      <View
        style={{
          position: 'absolute',
          width: size * 0.38,
          height: size * 0.12,
          borderRadius: size * 0.06,
          backgroundColor: color,
          right: 0,
          bottom: size * 0.1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

type Props = TextInputProps & { onClear?: () => void };

/** 돋보기 + 입력칸 + 지우기 */
export function SearchBar({ value, onClear, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Magnifier color={theme.textSecondary} />
      <TextInput
        value={value}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.input, { color: theme.text }, style]}
        accessibilityLabel="낚시터 검색"
        {...rest}
      />
      {value && onClear ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onClear}>
          <ThemedText type="small" themeColor="textSecondary">
            지우기
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: Spacing.two + 4 },
});
