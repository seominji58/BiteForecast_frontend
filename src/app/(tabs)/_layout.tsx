import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { Brand } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function icon(name: IconName, focusedName: IconName) {
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <MaterialCommunityIcons
        name={focused ? focusedName : name}
        size={24}
        color={focused ? Brand.orange : Brand.tabInactive}
      />
    );
  }
  return TabIcon;
}

// 탭: 홈(SCR-01) · 비교(SCR-02) · 기록(SCR-04/05) · 커뮤니티 · 내정보(SCR-06)
// iOS 26 시스템 탭(NativeTabs)은 반투명 유리 효과가 강제되어 배경색 지정이 무시되므로,
// 불투명 네이비 탭바를 위해 JS 탭을 사용한다.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.orange,
        tabBarInactiveTintColor: Brand.tabInactive,
        tabBarStyle: { backgroundColor: Brand.navyDeep, borderTopWidth: 0, elevation: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="compare" options={{ title: '비교', tabBarIcon: icon('chart-box-outline', 'chart-box') }} />
      <Tabs.Screen name="records" options={{ title: '기록', tabBarIcon: icon('notebook-edit-outline', 'notebook-edit') }} />
      <Tabs.Screen
        name="community"
        options={{ title: '커뮤니티', tabBarIcon: icon('account-group-outline', 'account-group') }}
      />
      <Tabs.Screen name="me" options={{ title: '내정보', tabBarIcon: icon('account-outline', 'account') }} />
    </Tabs>
  );
}
