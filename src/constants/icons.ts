/**
 * 앱 이미지 아이콘 (GPT 생성 시트를 잘라 만든 PNG, assets/icons).
 * - tab-*: 흰색 단색 마스크 → tintColor 로 색을 입힌다
 * - 그 외: 네이비·청록·주황 컬러 아이콘 → 어두운 배경에서도 보이도록 밝은 원 위에 올려 쓴다 (AppIcon badge)
 */
export const ICONS = {
  'cat-all': require('@/assets/icons/cat-all.png'),
  'cat-catch': require('@/assets/icons/cat-catch.png'),
  'cat-question': require('@/assets/icons/cat-question.png'),
  'cat-tip': require('@/assets/icons/cat-tip.png'),
  'comment': require('@/assets/icons/comment.png'),
  'fact': require('@/assets/icons/fact.png'),
  // 홈 「낚시터 찾기」 세트 (2026-11-05 추가: 내 주변·지도·조건·해황·비교)
  'find-compare': require('@/assets/icons/find-compare.png'),
  'find-criteria': require('@/assets/icons/find-criteria.png'),
  'find-gps': require('@/assets/icons/find-gps.png'),
  'find-map': require('@/assets/icons/find-map.png'),
  'find-sea': require('@/assets/icons/find-sea.png'),
  'fishing-index': require('@/assets/icons/fishing-index.png'),
  'like': require('@/assets/icons/like.png'),
  'medal': require('@/assets/icons/medal.png'),
  'place-beach': require('@/assets/icons/place-beach.png'),
  'place-breakwater': require('@/assets/icons/place-breakwater.png'),
  'place-rock': require('@/assets/icons/place-rock.png'),
  'place-wharf': require('@/assets/icons/place-wharf.png'),
  'regulation': require('@/assets/icons/regulation.png'),
  'report': require('@/assets/icons/report.png'),
  'tab-community-active': require('@/assets/icons/tab-community-active.png'),
  'tab-community': require('@/assets/icons/tab-community.png'),
  'tab-compare-active': require('@/assets/icons/tab-compare-active.png'),
  'tab-compare': require('@/assets/icons/tab-compare.png'),
  'tab-trips-active': require('@/assets/icons/tab-trips-active.png'),
  'tab-trips': require('@/assets/icons/tab-trips.png'),
  'tab-home-active': require('@/assets/icons/tab-home-active.png'),
  'tab-home': require('@/assets/icons/tab-home.png'),
  'tab-me-active': require('@/assets/icons/tab-me-active.png'),
  'tab-me': require('@/assets/icons/tab-me.png'),
  'tab-records-active': require('@/assets/icons/tab-records-active.png'),
  'tab-records': require('@/assets/icons/tab-records.png'),
  'tide-level': require('@/assets/icons/tide-level.png'),
  'tide': require('@/assets/icons/tide.png'),
  'total-fish': require('@/assets/icons/total-fish.png'),
  'trips': require('@/assets/icons/trips.png'),
  'trophy': require('@/assets/icons/trophy.png'),
  'water-temp': require('@/assets/icons/water-temp.png'),
  'wave': require('@/assets/icons/wave.png'),
  'wind': require('@/assets/icons/wind.png'),
  'write': require('@/assets/icons/write.png'),
} as const;

export type AppIconName = keyof typeof ICONS;
