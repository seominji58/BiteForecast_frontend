/** 방금 저장한 기록 결과 (축하 화면이 읽는다 — 화면 이동 파라미터로 큰 객체를 넘기지 않으려고, 2026-11-24) */
import type { JournalMutation } from '@/api/types';

let last: JournalMutation | null = null;
export const setLastSave = (r: JournalMutation) => {
  last = r;
};
export const takeLastSave = (): JournalMutation | null => last;
