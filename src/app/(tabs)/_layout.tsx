import { NativeTabs } from 'expo-router/native-tabs';

import { Brand } from '@/constants/theme';

// 탭: 홈(SCR-01) · 비교(SCR-02) · 기록(SCR-04/05) · 내정보(SCR-06, 설정 SCR-07 진입)
// 커뮤니티(공개 조황)는 정의서상 후속 버전이라 제외
// 아이콘: iOS = SF Symbols(sf), Android = Material Symbols(md)
export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor={Brand.navyDeep}
      tintColor={Brand.orange}
      indicatorColor="rgba(242, 140, 40, 0.18)"
      iconColor={{ default: Brand.tabInactive, selected: Brand.orange }}
      labelStyle={{ default: { color: Brand.tabInactive }, selected: { color: Brand.orange, fontWeight: '700' } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="compare">
        <NativeTabs.Trigger.Label>비교</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Label>기록</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.and.pencil" md="edit_note" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>내정보</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
