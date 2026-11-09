import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  maximumDate?: Date;
};

/**
 * 날짜+시간 선택.
 * - iOS: compact 피커 하나로 날짜·시간 선택
 * - Android: datetime 모드가 없으므로 날짜 / 시간 대화상자를 각각 연다
 */
export function DateTimeField({ value, onChange, maximumDate }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          locale="ko-KR"
          maximumDate={maximumDate}
          onValueChange={(_e, d) => onChange(d)}
        />
      </View>
    );
  }
  return <AndroidDateTimeField value={value} onChange={onChange} maximumDate={maximumDate} />;
}

/** 날짜 또는 시간 하나만 고르는 칸 (출조계획 날짜·시간) */
export function PickerField({
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  a11y,
  placeholder,
}: {
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  a11y: string;
  /** 값이 없을 때(시간 미정 등) 보여줄 글자 — 누르면 고른다 */
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const label = value
    ? mode === 'date'
      ? value.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
      : value.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : (placeholder ?? '선택');
  if (Platform.OS === 'ios' && (value || editing)) {
    return (
      <View style={styles.iosRow} accessibilityLabel={a11y}>
        <DateTimePicker
          value={value ?? defaultTime()}
          mode={mode}
          display="compact"
          locale="ko-KR"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_e, d) => onChange(d)}
        />
      </View>
    );
  }
  const open = () => {
    if (Platform.OS === 'ios') {
      setEditing(true);
      onChange(value ?? defaultTime());
      return;
    }
    DateTimePickerAndroid.open({
      value: value ?? defaultTime(),
      mode,
      is24Hour: true,
      minimumDate,
      maximumDate,
      onValueChange: (_e, d) => onChange(d),
    });
  };
  return <PickerButton label={label} a11y={a11y} onPress={open} />;
}

function defaultTime(): Date {
  const d = new Date();
  d.setHours(6, 0, 0, 0);
  return d;
}

function AndroidDateTimeField({ value, onChange, maximumDate }: Props) {
  const open = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      maximumDate: mode === 'date' ? maximumDate : undefined,
      onValueChange: (_e, d) => onChange(d),
    });

  const dateLabel = value.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });
  const timeLabel = value.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <View style={styles.androidRow}>
      <PickerButton label={dateLabel} a11y="출조 날짜 선택" onPress={() => open('date')} />
      <PickerButton label={timeLabel} a11y="출조 시간 선택" onPress={() => open('time')} />
    </View>
  );
}

function PickerButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerButton,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
      ]}>
      <ThemedText>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iosRow: { flexDirection: 'row' },
  androidRow: { flexDirection: 'row', gap: Spacing.two },
  pickerButton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
});
