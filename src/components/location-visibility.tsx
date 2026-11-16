/** 글 위치 공개 범위 고르기 (서비스 개선 설계 C2): 낚시터 이름 / 지역만 / 숨김. 기본은 지역만 */
import { StyleSheet, View } from 'react-native';

import { useRegions } from '@/api/queries';
import type { LocationVisibility } from '@/api/types';
import { Dropdown } from '@/components/dropdown';
import { Chip, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';

export const VISIBILITY_LABEL: Record<LocationVisibility, string> = {
  place: '낚시터 이름 공개',
  region: '지역만',
  hidden: '위치 숨김',
};

type Props = {
  value: LocationVisibility;
  onChange: (v: LocationVisibility) => void;
  /** 고른 낚시터가 있는지 (없으면 「낚시터 이름 공개」를 고를 수 없다) */
  hasPlace: boolean;
  /** 낚시터 없이 지역만 고르는 칸 (일반 글쓰기). 기록 공유처럼 낚시터가 정해져 있으면 넘기지 않는다 */
  region?: { id: number | null; onChange: (id: number | null) => void };
};

export function LocationVisibilityField({ value, onChange, hasPlace, region }: Props) {
  const regions = useRegions();
  const NONE = '0';
  return (
    <Field label="위치 공개 범위">
      <View style={styles.chips}>
        {(['place', 'region', 'hidden'] as const).map((v) => (
          <Chip
            key={v}
            label={VISIBILITY_LABEL[v]}
            selected={value === v}
            onPress={() => (v === 'place' && !hasPlace ? undefined : onChange(v))}
          />
        ))}
      </View>
      {region && !hasPlace && value === 'region' ? (
        <Dropdown
          label="지역"
          value={region.id != null ? String(region.id) : NONE}
          options={[
            { value: NONE, label: '지역 고르지 않음' },
            ...(regions.data ?? []).map((r) => ({ value: String(r.id), label: r.name })),
          ]}
          onChange={(v) => region.onChange(v === NONE ? null : Number(v))}
        />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {value === 'place'
          ? '낚시터 이름이 보이고, 그 낚시터 상세에도 나와요.'
          : value === 'region'
            ? hasPlace
              ? '낚시터 이름은 숨기고 「시·군」까지만 보여요.'
              : '고른 지역까지만 보여요. 지역 필터에서 찾을 수 있어요.'
            : '위치를 전혀 보여주지 않아요. 지역 필터에서도 나오지 않아요.'}
        {!hasPlace && value !== 'hidden' ? ' 낚시터 이름을 공개하려면 낚시터를 먼저 골라 주세요.' : ''}
      </ThemedText>
    </Field>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
