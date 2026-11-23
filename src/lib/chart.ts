/**
 * 하루 선 그래프 계산 (2026-11-23, 상세 화면 「오늘 바다」). 화면과 떼어 테스트한다.
 * x = 그날 기기 자정부터 지난 시간(0~24), y = 값. 빈 값(null)은 선을 끊는다.
 */
export type XY = { x: number; v: number };

export function dayPoints(points: { t: string; v: number | null }[] | null | undefined, date: string): XY[] {
  const t0 = new Date(`${date}T00:00:00`).getTime();
  return (points ?? [])
    .filter((p): p is { t: string; v: number } => p.v != null)
    .map((p) => ({ x: (new Date(p.t).getTime() - t0) / 3_600_000, v: p.v }))
    .filter((p) => p.x >= 0 && p.x <= 24)
    .sort((a, b) => a.x - b.x);
}

/** y 범위: 값들의 최소~최대에 위아래 여유 (값이 하나뿐이면 ±1). floor 를 주면 그 아래로 내리지 않는다 */
export function yRange(values: number[], floor?: number): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  if (floor != null && min < floor) min = floor;
  return { min, max };
}

export type Box = { w: number; h: number; min: number; max: number };
export const px = (x: number, b: Box) => (x / 24) * b.w;
export const py = (v: number, b: Box) => b.h - ((v - b.min) / (b.max - b.min)) * b.h;

/** 부드러운 선 (가로 방향 중간점을 제어점으로 하는 3차 곡선 — x 가 늘어나기만 해서 되돌아가지 않는다) */
export function linePath(pts: XY[], b: Box): string {
  if (!pts.length) return '';
  const P = pts.map((p) => [px(p.x, b), py(p.v, b)] as const);
  let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1];
    const [x1, y1] = P[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/** 선 아래를 채우는 영역 */
export function areaPath(pts: XY[], b: Box): string {
  if (!pts.length) return '';
  return `${linePath(pts, b)} L${px(pts[pts.length - 1].x, b).toFixed(1)},${b.h} L${px(pts[0].x, b).toFixed(1)},${b.h} Z`;
}

/** 어떤 시각(x)의 값: 앞뒤 점 사이를 직선으로 잇는다. 범위 밖이면 null */
export function valueAt(pts: XY[], x: number): number | null {
  if (!pts.length || x < pts[0].x || x > pts[pts.length - 1].x) return null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x <= b.x) return b.x === a.x ? b.v : a.v + ((b.v - a.v) * (x - a.x)) / (b.x - a.x);
  }
  return pts[pts.length - 1].v;
}

/** 지금 시각의 x (그날이 아니면 null) */
export function nowX(date: string, now = new Date()): number | null {
  const x = (now.getTime() - new Date(`${date}T00:00:00`).getTime()) / 3_600_000;
  return x >= 0 && x <= 24 ? x : null;
}
