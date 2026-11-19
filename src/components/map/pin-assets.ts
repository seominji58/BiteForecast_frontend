/* 자동 생성: scripts/make_map_pins.py — 직접 고치지 말 것 */
export type PinRing = 'good' | 'normal' | 'bad';

/** 어종 핀 (흰 원 + 어종 그림 + 테두리 색 = 공식 지수 등급) */
export const PIN: Record<string, Record<PinRing, number>> = {
  bigfin_squid: {
    good: require('@/assets/map/pins/bigfin_squid-good.png'),
    normal: require('@/assets/map/pins/bigfin_squid-normal.png'),
    bad: require('@/assets/map/pins/bigfin_squid-bad.png'),
  },
  black_porgy: {
    good: require('@/assets/map/pins/black_porgy-good.png'),
    normal: require('@/assets/map/pins/black_porgy-normal.png'),
    bad: require('@/assets/map/pins/black_porgy-bad.png'),
  },
  black_rockfish: {
    good: require('@/assets/map/pins/black_rockfish-good.png'),
    normal: require('@/assets/map/pins/black_rockfish-normal.png'),
    bad: require('@/assets/map/pins/black_rockfish-bad.png'),
  },
  conger: {
    good: require('@/assets/map/pins/conger-good.png'),
    normal: require('@/assets/map/pins/conger-normal.png'),
    bad: require('@/assets/map/pins/conger-bad.png'),
  },
  cuttlefish: {
    good: require('@/assets/map/pins/cuttlefish-good.png'),
    normal: require('@/assets/map/pins/cuttlefish-normal.png'),
    bad: require('@/assets/map/pins/cuttlefish-bad.png'),
  },
  flatfish: {
    good: require('@/assets/map/pins/flatfish-good.png'),
    normal: require('@/assets/map/pins/flatfish-normal.png'),
    bad: require('@/assets/map/pins/flatfish-bad.png'),
  },
  goby: {
    good: require('@/assets/map/pins/goby-good.png'),
    normal: require('@/assets/map/pins/goby-normal.png'),
    bad: require('@/assets/map/pins/goby-bad.png'),
  },
  greenling: {
    good: require('@/assets/map/pins/greenling-good.png'),
    normal: require('@/assets/map/pins/greenling-normal.png'),
    bad: require('@/assets/map/pins/greenling-bad.png'),
  },
  hairtail: {
    good: require('@/assets/map/pins/hairtail-good.png'),
    normal: require('@/assets/map/pins/hairtail-normal.png'),
    bad: require('@/assets/map/pins/hairtail-bad.png'),
  },
  halfbeak: {
    good: require('@/assets/map/pins/halfbeak-good.png'),
    normal: require('@/assets/map/pins/halfbeak-normal.png'),
    bad: require('@/assets/map/pins/halfbeak-bad.png'),
  },
  horse_mackerel: {
    good: require('@/assets/map/pins/horse_mackerel-good.png'),
    normal: require('@/assets/map/pins/horse_mackerel-normal.png'),
    bad: require('@/assets/map/pins/horse_mackerel-bad.png'),
  },
  mackerel: {
    good: require('@/assets/map/pins/mackerel-good.png'),
    normal: require('@/assets/map/pins/mackerel-normal.png'),
    bad: require('@/assets/map/pins/mackerel-bad.png'),
  },
  marbled_flounder: {
    good: require('@/assets/map/pins/marbled_flounder-good.png'),
    normal: require('@/assets/map/pins/marbled_flounder-normal.png'),
    bad: require('@/assets/map/pins/marbled_flounder-bad.png'),
  },
  mullet: {
    good: require('@/assets/map/pins/mullet-good.png'),
    normal: require('@/assets/map/pins/mullet-normal.png'),
    bad: require('@/assets/map/pins/mullet-bad.png'),
  },
  octopus: {
    good: require('@/assets/map/pins/octopus-good.png'),
    normal: require('@/assets/map/pins/octopus-normal.png'),
    bad: require('@/assets/map/pins/octopus-bad.png'),
  },
  opaleye: {
    good: require('@/assets/map/pins/opaleye-good.png'),
    normal: require('@/assets/map/pins/opaleye-normal.png'),
    bad: require('@/assets/map/pins/opaleye-bad.png'),
  },
  red_drum: {
    good: require('@/assets/map/pins/red_drum-good.png'),
    normal: require('@/assets/map/pins/red_drum-normal.png'),
    bad: require('@/assets/map/pins/red_drum-bad.png'),
  },
  red_rockfish: {
    good: require('@/assets/map/pins/red_rockfish-good.png'),
    normal: require('@/assets/map/pins/red_rockfish-normal.png'),
    bad: require('@/assets/map/pins/red_rockfish-bad.png'),
  },
  red_seabream: {
    good: require('@/assets/map/pins/red_seabream-good.png'),
    normal: require('@/assets/map/pins/red_seabream-normal.png'),
    bad: require('@/assets/map/pins/red_seabream-bad.png'),
  },
  rock_bream: {
    good: require('@/assets/map/pins/rock_bream-good.png'),
    normal: require('@/assets/map/pins/rock_bream-normal.png'),
    bad: require('@/assets/map/pins/rock_bream-bad.png'),
  },
  rockfish: {
    good: require('@/assets/map/pins/rockfish-good.png'),
    normal: require('@/assets/map/pins/rockfish-normal.png'),
    bad: require('@/assets/map/pins/rockfish-bad.png'),
  },
  seabass: {
    good: require('@/assets/map/pins/seabass-good.png'),
    normal: require('@/assets/map/pins/seabass-normal.png'),
    bad: require('@/assets/map/pins/seabass-bad.png'),
  },
  webfoot_octopus: {
    good: require('@/assets/map/pins/webfoot_octopus-good.png'),
    normal: require('@/assets/map/pins/webfoot_octopus-normal.png'),
    bad: require('@/assets/map/pins/webfoot_octopus-bad.png'),
  },
};

/** 최근 이용자 조황 주황 점 (핀 오른쪽 위 배지) */
export const BADGE_CATCH: number = require('@/assets/map/badge-catch.png');

/** 해상특보 발효 (핀 왼쪽 위 배지, 지수 테두리와 따로) */
export const BADGE_WARN: number = require('@/assets/map/badge-warn.png');
