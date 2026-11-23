/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FishingRules, SpeciesSeasons } from '@/api/types';

import { railBadge, yearCells } from './seasons.ts';

const seasons: SpeciesSeasons = {
  notice: '',
  species: {
    greenling: {
      name: '노래미',
      kind: 'spawn',
      periods: [{ months: [10, 11, 12, 1], peak: [11, 12], area: '인천', cite: 'c', url: 'u', note: null }],
      temps: [],
      text: null,
      cite: null,
      url: null,
    },
  },
};
const rules = {
  source: '', law_url: '', checked_at: '', notice: '', size: [],
  ban: [{ name: '쥐노래미', group: '어류', sci: '', periods: [{ from: '11-01', to: '12-31', region: null }], notice: false, note: null }],
  app_species: { greenling: ['쥐노래미'] },
} as FishingRules;

test('1년 달력: 산란기·성기·금어기(달에 하루라도 걸치면)', () => {
  const c = yearCells('greenling', 2026, seasons, rules);
  assert.deepEqual(c.filter((x) => x.spawn).map((x) => x.month), [1, 10, 11, 12]);
  assert.deepEqual(c.filter((x) => x.peak).map((x) => x.month), [11, 12]);
  assert.deepEqual(c.filter((x) => x.ban).map((x) => x.month), [11, 12]);
});

test('홈 배지: 금어기일 때만 (산란기는 배지로 달지 않음)', () => {
  assert.deepEqual(railBadge('greenling', '2026-11-23', rules), { label: '금어기', tone: 'danger' });
  assert.equal(railBadge('greenling', '2026-10-05', rules), null); // 산란기지만 배지 없음
  assert.equal(railBadge('greenling', '2026-06-01', rules), null);
});
