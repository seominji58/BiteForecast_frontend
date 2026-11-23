/**
 * 어종별 흔히 쓰는 낚시 방법·미끼 (2026-11-23). 국내 바다낚시에서 일반적으로 알려진 방법만 짧게 —
 * 지역·계절·배마다 다르므로 화면에 「참고」로 표시한다. 금지 어법(훌치기 등)은 넣지 않는다.
 */
export type Tackle = { how: string; bait: string };

export const TACKLE: Record<string, Tackle> = {
  rockfish: { how: '선상 외줄낚시 · 갯바위 루어(웜)', bait: '미꾸라지 · 오징어살 · 웜' },
  black_porgy: { how: '갯바위·방파제 찌낚시(반유동)', bait: '크릴 · 참갯지렁이, 크릴 밑밥' },
  seabass: { how: '루어(미노우·바이브레이션) · 찌낚시', bait: '루어 · 살아있는 새우' },
  rock_bream: { how: '갯바위 원투(처넘기기)', bait: '성게 · 참갯지렁이 · 소라' },
  opaleye: { how: '갯바위 찌낚시(전유동)', bait: '크릴, 크릴·빵가루 밑밥' },
  red_seabream: { how: '선상 타이라바 · 생미끼 외줄', bait: '타이라바 · 크릴' },
  black_rockfish: { how: '방파제 루어(지그헤드+웜) · 찌낚시, 주로 밤', bait: '웜 · 청갯지렁이 · 크릴' },
  red_rockfish: { how: '선상 카드채비(여러 바늘)', bait: '오징어살 · 크릴' },
  flatfish: { how: '선상 다운샷 · 생미끼', bait: '웜 · 살아있는 새우·미꾸라지' },
  webfoot_octopus: { how: '선상 에기+봉돌 채비', bait: '주꾸미용 에기' },
  cuttlefish: { how: '선상·방파제 에깅', bait: '에기(왕눈이 등)' },
  octopus: { how: '선상 문어 채비 · 방파제 에기', bait: '문어용 에기(애자)' },
  hairtail: { how: '선상 갈치 채비 · 방파제 찌낚시, 밤', bait: '꽁치살 · 갈치살, 케미라이트' },
  mackerel: { how: '방파제 카드채비', bait: '크릴(밑밥 함께)' },
  conger: { how: '방파제 원투, 밤', bait: '고등어살 · 꽁치살 · 갯지렁이' },
  greenling: { how: '방파제 원투 · 찌낚시', bait: '청갯지렁이 · 웜' },
  horse_mackerel: { how: '카드채비 · 소형 루어(아징)', bait: '크릴 · 소형 웜' },
  halfbeak: { how: '방파제 소형 찌낚시', bait: '크릴 · 곤쟁이' },
  mullet: { how: '찌낚시 · 루어', bait: '빵가루·떡밥 · 루어' },
  goby: { how: '짧은 낚싯대·원투, 갯벌·하구', bait: '갯지렁이' },
  bigfin_squid: { how: '갯바위·방파제 에깅', bait: '에기' },
  marbled_flounder: { how: '원투(모래·펄 바닥)', bait: '청갯지렁이' },
  red_drum: { how: '원투 · 루어', bait: '갯지렁이 · 새우 · 루어' },
  spanish_mackerel: { how: '캐스팅 루어 · 선상', bait: '메탈지그 · 스푼' },
  yellowtail: { how: '선상 지깅 · 생미끼', bait: '메탈지그 · 활어 미끼' },
  filefish: { how: '방파제·선상 소형 바늘', bait: '크릴 · 오징어살' },
  mitre_squid: { how: '선상 밤낚시(집어등), 이카메탈', bait: '이카메탈 · 에기' },
  gizzard_shad: { how: '방파제 카드채비', bait: '크릴(밑밥 함께)' },
  flounder: { how: '원투(모래·펄 바닥)', bait: '갯지렁이' },
  croaker: { how: '선상 생미끼 낚시(서해)', bait: '생새우' },
};
