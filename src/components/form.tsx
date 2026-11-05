import { type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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

type ButtonProps = { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'danger' };

export function Button({ label, onPress, disabled, variant = 'primary' }: ButtonProps) {
  const theme = useTheme();
  const bg = variant === 'danger' ? theme.danger : theme.tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      <ThemedText type="smallBold" themeColor="onTint">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
  },
});
