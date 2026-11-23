import assert from 'node:assert/strict';
import test from 'node:test';

import type { CatchSeasons, FishingRules } from '../api/types.ts';
import { banNews, inSeason } from './sea-news.ts';

const sea = (peak: number[], m: Record<string, number>) => ({ share: m, peak, tons_per_year: 100 });
const catches = {
  source: '',
  period: '',
  notice: '',
  species: {
    hairtail: { name: '갈치', seas: { 남해: sea([10, 11], { '11': 15.7 }), 서해: sea([11], { '11': 20 }) } },
    yellowtail: { name: '방어류', seas: { 동해: sea([11, 12], { '11': 12 }) } },
    rockfish: { name: '조피볼락', seas: { 서해: sea([11], { '11': 30 }) } },
    unknown_fish: { name: '모름', seas: { 남해: sea([11], { '11': 50 }) } },
    mackerel: { name: '고등어', seas: { 남해: sea([1], { '11': 9 }) } },
  },
} as unknown as CatchSeasons;
const known = (c: string) => c !== 'unknown_fish';

test('inSeason: 이번 달 어획 많은 어종, 비중 높은 순, 어선·낚시 시즌 다른 어종·모르는 코드 제외', () => {
  assert.deepEqual(
    inSeason(catches, 11, null, known).map((s) => [s.code, s.seas]),
    [
      ['hairtail', ['남해', '서해']],
      ['yellowtail', ['동해']],
    ],
  );
  assert.deepEqual(
    inSeason(catches, 11, '동해', known).map((s) => s.code),
    ['yellowtail'],
  );
  assert.deepEqual(inSeason(undefined, 11, null, known), []);
});

test('banNews: 최근 끝난 금어기와 곧 시작하는 금어기', () => {
  const rules = {
    ban: [
      { name: '주꾸미', notice: false, periods: [{ from: '05-11', to: '11-20', year: null, region: null }] },
      { name: '대구', notice: false, periods: [{ from: '12-01', to: '01-31', year: null, region: null }] },
      { name: '갈치', notice: false, periods: [{ from: '07-01', to: '07-31', year: null, region: null }] },
    ],
    size: [],
  } as unknown as FishingRules;
  assert.deepEqual(banNews(rules, '2026-11-23'), [
    { name: '주꾸미', kind: 'ended', days: 2 },
    { name: '대구', kind: 'soon', days: 8 },
  ]);
});
