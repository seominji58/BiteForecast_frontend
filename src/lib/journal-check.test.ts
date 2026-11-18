/**
 * 낚시일지 조과 검증 테스트 (2026-11-18)
 * 실행: npm run test:unit
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkCatch, type CatchCheck } from './journal-check.ts';

const base: CatchCheck = { skunk: false, speciesRequired: true, countRequired: true, hasSpecies: true, count: '1' };

test('잡았어요 + 어종 + 1마리 → 통과', () => {
  assert.equal(checkCatch(base), null);
});

test('잡았어요인데 마릿수 0 → 막는다', () => {
  assert.equal(checkCatch({ ...base, count: '0' })?.field, 'count');
  assert.equal(checkCatch({ ...base, count: '00' })?.field, 'count');
});

test('잡았어요 + 새 기록인데 마릿수 비움 → 막는다', () => {
  assert.equal(checkCatch({ ...base, count: '  ' })?.field, 'count');
});

test('잡았어요 + 새 기록인데 어종 없음 → 막는다', () => {
  assert.equal(checkCatch({ ...base, hasSpecies: false })?.field, 'species');
});

test('예전 기록(어종·마릿수 없이 저장됨) 수정은 그대로 저장', () => {
  assert.equal(checkCatch({ ...base, speciesRequired: false, countRequired: false, hasSpecies: false, count: '' }), null);
});

test('예전 기록이라도 잡았어요에 0마리는 막는다', () => {
  assert.equal(checkCatch({ ...base, speciesRequired: false, countRequired: false, count: '0' })?.field, 'count');
});

test('못 잡았어요 → 어종·마릿수를 보지 않는다', () => {
  assert.equal(checkCatch({ ...base, skunk: true, hasSpecies: false, count: '' }), null);
});
