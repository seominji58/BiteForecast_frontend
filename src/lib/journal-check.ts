/**
 * 낚시일지 조과 입력 검증 (2026-11-18). 화면과 분리해 단위 테스트한다.
 * - 못 잡았어요: 어종·마릿수를 보지 않는다 (마릿수 0 으로 저장 — 「못 잡은 날」)
 * - 잡았어요: 마릿수 0 은 저장 불가 (못 잡은 날과 구분이 안 됨)
 * - 잡았어요 + 새 기록: 어종·마릿수 필수 (도감·조황 연결)
 * - 예전 기록 수정: 원래 비어 있던 칸(어종 없음·마릿수 미입력)은 막지 않는다
 */
export type CatchCheck = {
  skunk: boolean;
  /** 어종을 반드시 받아야 하는가 (새 기록이거나, 수정 전 기록에 어종이 있었음) */
  speciesRequired: boolean;
  /** 마릿수를 반드시 받아야 하는가 (새 기록이거나, 수정 전 기록에 마릿수가 있었음) */
  countRequired: boolean;
  hasSpecies: boolean;
  /** 입력한 마릿수 원문 (빈 값 허용) */
  count: string;
};

export type CatchError = { field: 'species' | 'count'; text: string };

export function checkCatch(c: CatchCheck): CatchError | null {
  if (c.skunk) return null;
  if (c.speciesRequired && !c.hasSpecies)
    return { field: 'species', text: '잡은 어종을 골라 주세요. 못 잡았으면 「오늘은 못 잡았어요」를 고르세요.' };
  const n = c.count.trim();
  if (!n) return c.countRequired ? { field: 'count', text: '잡은 마릿수를 입력해 주세요.' } : null;
  if (/^\d+$/.test(n) && Number(n) === 0)
    return { field: 'count', text: '잡았으면 마릿수는 1 이상이에요. 못 잡았으면 「오늘은 못 잡았어요」를 고르세요.' };
  return null;
}
