import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/form';
import { Card, SectionHeader, StackScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import type { AppIconName } from '@/constants/icons';

/**
 * 금어기·출조 안전 정보.
 * 근거: 「수산자원관리법 시행령」 [대통령령 제36260호, 2026. 4. 14. 시행] 제6조·제7조의2 (원문 확인한 조항만 적는다).
 * 어종별 금어기·금지체장 표(별표 1·2)는 원문 별표를 받아 확인한 뒤 추가한다 — 임의로 만들지 않는다.
 */
export default function SafetyInfoScreen() {
  return (
    <StackScreen>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          수산자원관리법 시행령 (대통령령 제36260호, 2026. 4. 14. 시행) 원문 기준으로 정리했어요. 지역마다 시·도 조례로
          기준이 더 있을 수 있으니 출조 지역 기준도 확인하세요.
        </ThemedText>
      </Card>

      <SectionHeader title="출조 전 확인" />
      <Card>
        <Line icon="report" text="해상 특보(풍랑·태풍 등)를 확인하세요. 앱의 낚시터 상세 해황 맨 위에 기상청 특보가 나와요." />
        <Line icon="regulation" text="방파제·갯바위·테트라포드는 출입이 통제된 곳이 있어요. 현장 안내판과 지자체 공지를 따르세요." />
        <Line icon="tide" text="갯바위·갯벌은 물때를 확인하고 들물 시간 전에 나오세요. 상세 해황에서 만조·간조 시각을 볼 수 있어요." />
        <Line icon="cat-tip" text="구명조끼를 입고, 혼자 출조할 때는 장소와 귀가 시간을 가족에게 알려 두세요." />
        <Button label="오늘 해황·특보 보러 가기" variant="secondary" onPress={() => router.push('/explore')} />
      </Card>

      <SectionHeader title="금어기·금지체장" />
      <Card>
        <ThemedText type="small">
          수산자원의 포획·채취가 금지되는 기간·구역·수심(금어기)은 시행령 <B>별표 1</B>, 포획이 금지되는 크기·무게(금지체장)는{' '}
          <B>별표 2</B>에서 정해요 (제6조 제1항·제2항).
        </ThemedText>
        <ThemedText type="small">
          다음 암컷은 시기와 관계없이 잡으면 안 돼요 (제6조 제3항):{'\n'}• 대게의 암컷, 붉은 대게의 암컷{'\n'}• 배 바깥에 알이 붙어
          있는 꽃게·민꽃게의 암컷
        </ThemedText>
        <View style={styles.note}>
          <ThemedText type="small" themeColor="warning">
            어종별 금어기·금지체장 표는 별표 원문을 확인한 뒤 앱에 추가할 예정이에요. 지금은 국가법령정보센터에서 「수산자원관리법
            시행령」 별표 1·2를 확인하세요.
          </ThemedText>
        </View>
      </Card>

      <SectionHeader title="낚시인(비어업인)이 지킬 것" />
      <Card>
        <ThemedText type="small">
          어업인이 아닌 사람은 정해진 도구만 쓸 수 있어요 (제7조의2 제1항). 낚시는 <B>외줄낚시(대낚시·손줄낚시)</B>가 해당되고,
          「낚시 관리 및 육성법」의 기준을 따라요.
        </ThemedText>
        <ThemedText type="small">
          투망·뜰채·반두·통발 등 다른 도구를 쓸 때는 (제7조의2 제2항){'\n'}• 같은 종류 도구는 한 사람이 동시에 1개까지{'\n'}• 전기·압축공기
          같은 동력 사용 금지{'\n'}• 물고기를 모으는 집어등 사용 금지 (시야 확보용 휴대 전등은 사용 가능)
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          시·도는 조례로 포획·채취 기준을 따로 정할 수 있어요 (제7조의2 제4항).
        </ThemedText>
      </Card>

      <SectionHeader title="문의" />
      <Card>
        <ThemedText type="small">해양수산부 수산자원정책과</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          금어기·금지체장: 051-773-5540, 5541{'\n'}비어업인의 포획·채취: 051-773-5542, 5535
        </ThemedText>
      </Card>
    </StackScreen>
  );
}

function B({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" style={styles.inlineBold}>
      {children}
    </ThemedText>
  );
}

function Line({ icon, text }: { icon: AppIconName; text: string }) {
  return (
    <View style={styles.line}>
      <AppIcon name={icon} size={22} />
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  note: { borderRadius: 8, padding: 8, backgroundColor: 'rgba(168,98,0,0.08)' },
  inlineBold: { fontSize: 12 },
});
