import { type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {label}
        {required ? ' *' : ''}
      </ThemedText>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        props.multiline && styles.multiline,
        props.style,
      ]}
    />
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.tint : theme.backgroundElement,
          borderColor: selected ? theme.tint : theme.backgroundSelected,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'onTint' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** primary = 주황(주요 동작), secondary = 틸 테두리, danger = 빨강(삭제), navy = 네이비(로그아웃 등 중립 동작). 색이 꽉 찬 버튼은 글자가 흰색 */
  variant?: 'primary' | 'secondary' | 'danger' | 'navy';
  icon?: AppIconName;
};

export function Button({ label, onPress, disabled, variant = 'primary', icon }: ButtonProps) {
  const theme = useTheme();
  const outline = variant === 'secondary';
  const bg = variant === 'danger' ? theme.danger : variant === 'navy' ? Brand.navy : outline ? 'transparent' : theme.accent;
  const fg = variant === 'primary' ? 'onAccent' : outline ? 'tint' : 'onTint';
  // 빨강·네이비 꽉 찬 버튼은 다크 모드에서도 흰 글자 (onTint 는 다크에서 어두운색이라 안 보임)
  const white = variant === 'danger' || variant === 'navy';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        outline && { borderWidth: 1.5, borderColor: theme.tint },
      ]}>
      {icon ? <AppIcon name={icon} size={22} badge /> : null}
      <ThemedText type="smallBold" themeColor={fg} style={white ? styles.white : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  white: { color: '#FFFFFF' },
  field: { gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 11,
    minHeight: 48,
    borderRadius: 10,
  },
});
