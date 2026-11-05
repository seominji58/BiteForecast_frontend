import { Tabs } from 'expo-router/js-tabs';

import { AppIcon } from '@/components/app-icon';
import type { AppIconName } from '@/constants/icons';
import { Brand } from '@/constants/theme';

type TabKey = 'home' | 'compare' | 'records' | 'community' | 'me';

function icon(key: TabKey) {
  function TabIcon({ focused }: { focused: boolean }) {
    const name = (focused ? `tab-${key}-active` : `tab-${key}`) as AppIconName;
    return <AppIcon name={name} size={24} tint={focused ? Brand.orange : Brand.tabInactive} />;
  }
  return TabIcon;
}

// 탭: 홈(SCR-01) · 비교(SCR-02) · 기록(SCR-04/05) · 커뮤니티 · 내정보(SCR-06)
// iOS 26 시스템 탭(NativeTabs)은 반투명 유리 효과가 강제되어 배경색 지정이 무시되므로,
// 불투명 네이비 탭바를 위해 JS 탭을 사용한다. 아이콘은 단색 이미지에 색을 입혀 쓴다.
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
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="compare" options={{ title: '비교', tabBarIcon: icon('compare') }} />
      <Tabs.Screen name="records" options={{ title: '기록', tabBarIcon: icon('records') }} />
      <Tabs.Screen name="community" options={{ title: '커뮤니티', tabBarIcon: icon('community') }} />
      <Tabs.Screen name="me" options={{ title: '내정보', tabBarIcon: icon('me') }} />
    </Tabs>
  );
}
