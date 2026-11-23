/**
 * 금어기 계산 테스트 (2026-11-23)
 * 실행: npm run test:unit
 */
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FishingRules } from '@/api/types';

import { activeBans, inPeriod, periodText, rulesForSpecies, upcomingBans } from './rules.ts';

const P = (from: string, to: string, region: string | null = null) => ({ from, to, region });
const rules: FishingRules = {
  source: 's',
  law_url: 'u',
  checked_at: '2026-11-23',
  notice: 'n',
  ban: [
    { name: '감성돔', group: '어류', sci: '', periods: [P('05-01', '05-31')], notice: false, note: null },
    { name: '문치가자미', group: '어류', sci: '', periods: [P('12-01', '01-31')], notice: false, note: null },
    { name: '쥐노래미', group: '어류', sci: '', periods: [P('11-01', '12-31')], notice: false, note: null },
    { name: '고등어', group: '어류', sci: '', periods: [P('04-01', '06-30')], notice: true, note: '고시' },
    { name: '전복류', group: '패류', sci: '', periods: [P('09-01', '10-31', '제주 외'), P('10-01', '12-31', '제주')], notice: false, note: null },
  ],
  size: [{ name: '감성돔', group: '어류', limit: '25cm 이하', measure: '전장', measure_desc: '', note: null }],
  app_species: { black_porgy: ['감성돔'], marbled_flounder: ['문치가자미'] },
};

test('기간: 해를 넘기는 금어기와 끝날 포함', () => {
  assert.equal(inPeriod(P('12-01', '01-31'), '2026-12-15'), true);
  assert.equal(inPeriod(P('12-01', '01-31'), '2027-01-31'), true);
  assert.equal(inPeriod(P('12-01', '01-31'), '2027-02-01'), false);
  assert.equal(inPeriod(P('05-01', '05-31'), '2026-05-31'), true);
  assert.equal(inPeriod(P('05-01', '05-31'), '2026-04-30'), false);
});

test('지금 금어기: 고시 어종은 빼고, 지역 기간은 해당 지역만', () => {
  const nov = activeBans(rules, '2026-11-23').map((a) => `${a.rule.name}:${a.periods.map(periodText).join('/')}`);
  assert.deepEqual(nov, ['쥐노래미:11.1~12.31', '전복류:10.1~12.31 (제주)']);
  assert.equal(activeBans(rules, '2026-05-10').some((a) => a.rule.name === '고등어'), false);
});

test('다가오는 금어기: 30일 안에 시작, 가까운 순', () => {
  const up = upcomingBans(rules, '2026-11-23', 30);
  assert.deepEqual(up.map((u) => [u.rule.name, u.inDays]), [['문치가자미', 8]]);
});

test('앱 어종 → 규정', () => {
  const r = rulesForSpecies(rules, 'black_porgy');
  assert.equal(r.bans[0].name, '감성돔');
  assert.equal(r.sizes[0].limit, '25cm 이하');
  assert.deepEqual(rulesForSpecies(rules, 'goby'), { bans: [], sizes: [] });
});
