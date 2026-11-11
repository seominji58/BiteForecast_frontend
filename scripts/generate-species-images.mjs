#!/usr/bin/env node
/**
 * 어종 일러스트 생성 (OpenAI Images API) — 로컬에서만 실행, 앱 번들에 키가 들어가지 않는다.
 *
 *   node scripts/generate-species-images.mjs                 # 미리보기(dry-run): 대상·프롬프트·예상 비용만, 호출 없음
 *   node scripts/generate-species-images.mjs --run           # 실제 생성(유료). 이미 만든 후보는 건너뜀
 *   node scripts/generate-species-images.mjs --run --only opaleye,rock_bream --force   # 특정 어종만 다시
 *   node scripts/generate-species-images.mjs --approve rockfish,seabass               # 검수 통과 → 앱 에셋으로
 *
 * 옵션: --model (기본 gpt-image-2.6-flare) --quality low|medium|high (기본 medium)
 *
 * - 키: 환경변수 OPENAI_API_KEY, 없으면 backend/.env 에서 읽는다. 출력·로그·파일에 남기지 않는다
 * - 후보: assets/species/_candidates/<code>.png + <code>.json(모델·품질·프롬프트·사용 토큰) — git 제외
 * - 승인: assets/species/<code>.png 로 복사 + assets/species/approved.json 에 기록 (앱은 이것만 쓴다)
 * - 같은 프롬프트로 만든 후보가 있으면 다시 만들지 않는다(--force 로 강제). 실패해도 나머지는 계속
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'assets', 'species');
const CAND = join(DIR, '_candidates');
const catalog = JSON.parse(readFileSync(join(DIR, 'catalog.json'), 'utf8')).species;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const MODEL = opt('model', 'gpt-image-2.6-flare');
const QUALITY = opt('quality', 'medium');
const SIZE = '1024x1024';
const only = opt('only', null)?.split(',').map((s) => s.trim());

// 비용 추정: 출력 토큰 단가 $30/1M (2026-11 공식 가격표). 1024x1024 출력 토큰은 이전 세대 기준값을 쓰고
// 2.6 에서 다를 수 있어 2배 여유를 둔다. 실제 사용량은 응답 usage 로 기록한다
const OUT_PER_M = 30;
const TOKENS = { low: 400, medium: 1449, high: 5800 }; // medium 은 2026-11-11 시범 실측, low·high 는 비율로 추정
const perImage = (q) => ((TOKENS[q] ?? TOKENS.high) * OUT_PER_M) / 1e6;

const STYLE = [
  'Highly detailed, realistic natural-history illustration of a real Korean sea-fishing target species, like a premium field-guide painting, for a mobile fishing app.',
  'Exactly one animal, whole body visible, centered, filling about 80% of a square frame.',
  'Biologically accurate proportions, fin or arm placement, scales, skin texture and markings so an experienced angler immediately recognizes the species.',
  'Natural true-to-life colors with soft studio lighting and gentle depth; crisp clean edges against the background. Do not stylize as cartoon, flat vector or 3D toy.',
  'Transparent background. No water, no splash, no bubbles, no hooks, no lines, no scenery, no drop shadow, no glow, no frame, no other animals.',
  'Absolutely no text, letters, numbers, labels or logos.',
  'Must stay recognizable when shown as small as 56 pixels.',
].join(' ');

const promptFor = (s) =>
  `${STYLE}\nSubject: ${s.english} (${s.scientific}), known in Korea as ${s.name_ko}. View: ${s.view}. ` +
  `Key features to depict: ${s.features.join('; ')}.`;
const sha = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const env = join(ROOT, '..', 'backend', '.env');
  if (existsSync(env)) {
    for (const line of readFileSync(env, 'utf8').split('\n')) {
      const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

const targets = catalog.filter((s) => !only || only.includes(s.code));
if (only) {
  const unknown = only.filter((c) => !catalog.some((s) => s.code === c));
  if (unknown.length) {
    console.error(`알 수 없는 어종 코드: ${unknown.join(', ')}`);
    process.exit(1);
  }
}

// --- 승인: 후보 → 앱 에셋 ---
if (flag('approve')) {
  const codes = opt('approve', '').split(',').filter(Boolean);
  const ledgerPath = join(DIR, 'approved.json');
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};
  for (const code of codes) {
    const png = join(CAND, `${code}.png`);
    if (!existsSync(png)) {
      console.error(`후보 없음: ${code}`);
      continue;
    }
    const meta = JSON.parse(readFileSync(join(CAND, `${code}.json`), 'utf8'));
    copyFileSync(png, join(DIR, `${code}.png`));
    ledger[code] = { ...meta, approved_at: new Date().toISOString() };
    delete ledger[code].prompt; // 프롬프트 전문은 후보 메타에만
    console.log(`승인: ${code} → assets/species/${code}.png`);
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  process.exit(0);
}

const run = flag('run');
const force = flag('force');
mkdirSync(CAND, { recursive: true });

const plan = targets.map((s) => {
  const prompt = promptFor(s);
  const metaPath = join(CAND, `${s.code}.json`);
  const prev = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;
  const same = prev && prev.prompt_sha === sha(prompt) && prev.model === MODEL && prev.quality === QUALITY;
  return { s, prompt, skip: !force && same && existsSync(join(CAND, `${s.code}.png`)) };
});
const todo = plan.filter((p) => !p.skip);

console.log(`모델 ${MODEL} · ${SIZE} · 품질 ${QUALITY} · 투명 배경 PNG`);
console.log(`대상 ${plan.length}종 (새로 생성 ${todo.length} · 이미 있음 ${plan.length - todo.length})`);
for (const p of plan) console.log(`  ${p.skip ? '건너뜀' : '생성  '} ${p.s.code.padEnd(15)} ${p.s.name_ko}`);
const est = todo.length * perImage(QUALITY);
console.log(
  `예상 비용: 약 $${est.toFixed(2)} (장당 약 $${perImage(QUALITY).toFixed(3)}, 출력 토큰 추정) · 보수적으로 최대 약 $${(est * 2).toFixed(2)}`,
);

if (!run) {
  console.log('\n미리보기만 했어요(호출 없음). 실제 생성은 --run');
  if (flag('show-prompt') && plan[0]) console.log(`\n프롬프트 예 (${plan[0].s.code}):\n${plan[0].prompt}`);
  process.exit(0);
}

const key = apiKey();
if (!key) {
  console.error('OPENAI_API_KEY 가 없습니다 (환경변수 또는 backend/.env)');
  process.exit(1);
}
const redact = (t) => String(t).split(key).join('***').replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***');

let ok = 0;
let fail = 0;
let outTokens = 0;
for (const p of todo) {
  const { s, prompt } = p;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: SIZE,
        quality: QUALITY,
        background: 'transparent',
        output_format: 'png',
        n: 1,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status} ${body?.error?.code ?? ''} ${body?.error?.message ?? ''}`);
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new Error('응답에 이미지 없음');
    writeFileSync(join(CAND, `${s.code}.png`), Buffer.from(b64, 'base64'));
    const usage = body.usage ?? null;
    outTokens += usage?.output_tokens ?? 0;
    writeFileSync(
      join(CAND, `${s.code}.json`),
      JSON.stringify(
        {
          code: s.code,
          name_ko: s.name_ko,
          scientific: s.scientific,
          model: MODEL,
          size: SIZE,
          quality: QUALITY,
          background: 'transparent',
          prompt_sha: sha(prompt),
          prompt,
          usage,
          created_at: new Date().toISOString(),
          review: { checklist: s.features, status: 'pending' },
        },
        null,
        2,
      ) + '\n',
    );
    ok += 1;
    console.log(`완료 ${s.code}${usage?.output_tokens ? ` (출력 토큰 ${usage.output_tokens})` : ''}`);
  } catch (e) {
    fail += 1;
    console.error(`실패 ${s.code}: ${redact(e.message ?? e)}`);
  }
}
console.log(
  `\n성공 ${ok} · 실패 ${fail}` +
    (outTokens ? ` · 실제 출력 토큰 ${outTokens} ≈ $${((outTokens * OUT_PER_M) / 1e6).toFixed(3)}` : ''),
);
process.exit(fail ? 1 : 0);
