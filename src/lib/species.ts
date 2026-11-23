/**
 * 홈 어종 탐색용 어종 목록 (설계 docs/05_UX/화면_설계.md 개정 v2).
 *
 * - indexName: 국립해양조사원 바다낚시지수의 어종 이름 그대로. 있으면 「공식 지수 제공 어종」
 * - speciesCode: 앱 어종 기준표(species) 코드. 없으면 출조계획·기록에는 기타 입력(이름)으로 저장
 * - 공식 지수가 없는 어종에 등급·추천 장소를 만들지 않는다
 */
import type { SpeciesValue } from '@/components/species-field';

export type SpeciesItem = {
  /** 이미지 파일·화면에서 쓰는 코드 (assets/species/<code>.png) */
  code: string;
  name: string;
  /** 표시용 보조 이름 (예: 조피볼락) */
  alias?: string;
  indexName: string | null;
  speciesCode: string | null;
};

/** 공식 지수 8종 (제공 지점이 많은 순) → 추가 어종 (모두 이미지 있음, 2026-11-16 8종 추가) */
export const SPECIES: SpeciesItem[] = [
  { code: 'rockfish', name: '우럭', alias: '조피볼락', indexName: '우럭', speciesCode: 'rockfish' },
  { code: 'black_porgy', name: '감성돔', indexName: '감성돔', speciesCode: 'black_porgy' },
  { code: 'seabass', name: '농어', indexName: '농어', speciesCode: 'seabass' },
  { code: 'rock_bream', name: '돌돔', indexName: '돌돔', speciesCode: null },
  { code: 'opaleye', name: '벵에돔', indexName: '벵에돔', speciesCode: null },
  { code: 'red_seabream', name: '참돔', indexName: '참돔', speciesCode: 'red_seabream' },
  { code: 'black_rockfish', name: '볼락', indexName: '볼락', speciesCode: 'black_rockfish' },
  { code: 'red_rockfish', name: '열기', alias: '불볼락', indexName: '열기', speciesCode: null },
  { code: 'flatfish', name: '광어', alias: '넙치', indexName: null, speciesCode: 'flatfish' },
  { code: 'webfoot_octopus', name: '주꾸미', indexName: null, speciesCode: 'webfoot_octopus' },
  { code: 'cuttlefish', name: '갑오징어', indexName: null, speciesCode: 'cuttlefish' },
  { code: 'octopus', name: '문어', indexName: null, speciesCode: null },
  { code: 'hairtail', name: '갈치', indexName: null, speciesCode: null },
  { code: 'mackerel', name: '고등어', indexName: null, speciesCode: 'mackerel' },
  { code: 'conger', name: '붕장어', indexName: null, speciesCode: null },
  { code: 'greenling', name: '노래미', indexName: null, speciesCode: 'greenling' },
  { code: 'horse_mackerel', name: '전갱이', indexName: null, speciesCode: 'horse_mackerel' },
  { code: 'halfbeak', name: '학꽁치', indexName: null, speciesCode: 'halfbeak' },
  { code: 'mullet', name: '숭어', indexName: null, speciesCode: 'mullet' },
  { code: 'goby', name: '망둥어', indexName: null, speciesCode: 'goby' },
  { code: 'bigfin_squid', name: '무늬오징어', indexName: null, speciesCode: 'bigfin_squid' },
  // 2026-11-16: 낚시터 공공데이터에 많이 나오는 어종 (도다리 37곳·점성어 8곳), 기준표 0006
  { code: 'marbled_flounder', name: '도다리', alias: '문치가자미', indexName: null, speciesCode: 'marbled_flounder' },
  { code: 'red_drum', name: '점성어', indexName: null, speciesCode: 'red_drum' },
  // 2026-11-23: 통계청 어업생산동향조사로 「어획 많은 달」을 계산한 바다낚시 어종 (기준표 0009). 그림 없으면 기본 아이콘
  { code: 'spanish_mackerel', name: '삼치', indexName: null, speciesCode: 'spanish_mackerel' },
  { code: 'yellowtail', name: '방어', indexName: null, speciesCode: 'yellowtail' },
  { code: 'filefish', name: '쥐치', indexName: null, speciesCode: 'filefish' },
  { code: 'mitre_squid', name: '한치', indexName: null, speciesCode: 'mitre_squid' },
  { code: 'gizzard_shad', name: '전어', indexName: null, speciesCode: 'gizzard_shad' },
  { code: 'flounder', name: '가자미', indexName: null, speciesCode: 'flounder' },
  { code: 'croaker', name: '민어', indexName: null, speciesCode: 'croaker' },
];

const BY_CODE = new Map(SPECIES.map((s) => [s.code, s]));
export const speciesByCode = (code: string | null | undefined) => (code ? BY_CODE.get(code) ?? null : null);

/** 앱 어종 기준표(API /species)에 새로 생긴 어종도 목록에서 빠지지 않게 덧붙인다 (이미지 없으면 기본 아이콘) */
export function mergeWithApi(api: { code: string; name_ko: string }[] | undefined): SpeciesItem[] {
  const known = new Set(SPECIES.map((s) => s.speciesCode).filter(Boolean));
  const extra = (api ?? [])
    .filter((s) => !known.has(s.code))
    .map((s) => ({ code: s.code, name: s.name_ko, indexName: null, speciesCode: s.code }));
  return [...SPECIES, ...extra];
}

/** 출조계획 목표 어종: 기준표 코드가 있으면 코드, 없으면 기타 입력(이름) — DB 변경 없음 */
export function toSpeciesValue(s: SpeciesItem): SpeciesValue {
  return s.speciesCode ? { code: s.speciesCode, etc: null } : { code: null, etc: s.name };
}

/** 공식 지수 등급 순서 (기관 발표 5단계). 앱이 만든 점수가 아니다 */
export const GRADE_RANK: Record<string, number> = { 매우좋음: 5, 좋음: 4, 보통: 3, 나쁨: 2, 매우나쁨: 1 };

export const GRADE_TONE: Record<string, 'success' | 'tint' | 'textSecondary' | 'warning' | 'danger'> = {
  매우좋음: 'success',
  좋음: 'success',
  보통: 'textSecondary',
  나쁨: 'warning',
  매우나쁨: 'danger',
};

export const INDEX_DISCLAIMER = '국립해양조사원 발표 지수예요. 「좋음」·「보통」은 실제 조과나 출조 안전을 보장하지 않아요.';

export const speciesByIndexName = (name: string) => SPECIES.find((s) => s.indexName === name) ?? null;

/** 출조계획·기록의 어종(기준표 코드 또는 기타 입력 이름) → 목록 항목 */
export const speciesForRecord = (code: string | null, etc: string | null) =>
  (code ? SPECIES.find((s) => s.speciesCode === code) : null) ??
  (etc ? SPECIES.find((s) => s.name === etc.trim() || s.alias === etc.trim()) : null) ??
  null;

/** 받침에 맞는 조사 (주꾸미는 / 우럭은, 주꾸미가 / 우럭이) */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const c = word.charCodeAt(word.length - 1);
  const hasFinal = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}
