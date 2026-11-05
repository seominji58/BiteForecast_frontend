"""GPT 아이콘 시트를 칸별로 잘라 정사각형 PNG 로 저장.

- 거의 투명한 잡티(alpha < 40) 제거, 칸 안의 아주 작은 조각(잡티) 제거
- 투명 여백 기준으로 행 → 열 순서로 아이콘 영역을 찾는다 (가까운 조각은 한 아이콘으로 병합)
- 탭 아이콘은 코드에서 색을 입히므로 흰색 단색 마스크로 만든다
- 리사이즈는 premultiplied alpha 로 해서 가장자리 검은 테두리를 막는다
사용: python slice.py <src_dir> <out_dir>
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

SHEETS = {
    "tab": {
        "rows": 2, "cols": 5, "size": 144, "mono": True,
        "names": ["tab-home", "tab-compare", "tab-records", "tab-community", "tab-me",
                  "tab-home-active", "tab-compare-active", "tab-records-active", "tab-community-active", "tab-me-active"],
    },
    "metric": {
        "rows": 2, "cols": 4, "size": 192, "mono": False,
        "names": ["wave", "tide", "wind", "water-temp", "tide-level", "fishing-index", "regulation", "fact"],
    },
    "place": {
        "rows": 1, "cols": 4, "size": 256, "mono": False,
        "names": ["place-breakwater", "place-rock", "place-wharf", "place-beach"],
    },
    "community": {
        "rows": 3, "cols": 4, "size": 192, "mono": False,
        "names": ["cat-all", "cat-catch", "cat-question", "cat-tip", "like", "comment", "report", "write",
                  "medal", "trips", "total-fish", "trophy"],
    },
}


def runs(profile: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """값이 있는 구간들. min_gap 보다 짧은 빈 구간은 이어 붙인다"""
    idx = np.where(profile > 0)[0]
    if len(idx) == 0:
        return []
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > min_gap:
            out.append((start, prev + 1))
            start = i
        prev = i
    out.append((start, prev + 1))
    return out


def find_cells(mask: np.ndarray, rows: int, cols: int) -> list[tuple[int, int, int, int]]:
    """간격 임계값을 바꿔가며 정확히 rows × cols 영역이 나오는 분할을 찾는다"""
    h, w = mask.shape
    for rgap in range(10, h // 4, 5):
        rr = runs(mask.sum(axis=1), rgap)
        if len(rr) != rows:
            continue
        cells = []
        for y0, y1 in rr:
            band = mask[y0:y1]
            for cgap in range(10, w // 4, 5):
                cc = runs(band.sum(axis=0), cgap)
                if len(cc) == cols:
                    cells += [(x0, y0, x1, y1) for x0, x1 in cc]
                    break
            else:
                break
        if len(cells) == rows * cols:
            return cells
    raise SystemExit(f"{rows}x{cols} 분할 실패")


def clean_alpha(a: np.ndarray) -> np.ndarray:
    alpha = a[..., 3].astype(float)
    alpha[alpha < 40] = 0
    return alpha


def export(sheet: str, cfg: dict) -> None:
    im = np.array(Image.open(SRC / f"{sheet}.png").convert("RGBA"))
    alpha = clean_alpha(im)
    if cfg["mono"]:
        # 반투명한 흰 선을 또렷한 마스크로: 40~180 구간을 0~255 로 늘림
        alpha = np.clip((alpha - 40) * 255 / 140, 0, 255)
    mask = alpha > 0
    cells = find_cells(mask, cfg["rows"], cfg["cols"])

    for name, (x0, y0, x1, y1) in zip(cfg["names"], cells):
        sub_mask = mask[y0:y1, x0:x1]
        # 칸 안 작은 조각(잡티) 제거: 가장 큰 조각 면적의 1.5% 미만
        lab, n = ndimage.label(sub_mask)
        if n > 1:
            sizes = ndimage.sum(sub_mask, lab, range(1, n + 1))
            keep = np.isin(lab, np.where(sizes >= sizes.max() * 0.015)[0] + 1)
        else:
            keep = sub_mask
        ys, xs = np.where(keep)
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1

        rgba = im[y0:y1, x0:x1].copy().astype(float)
        rgba[..., 3] = np.where(keep, alpha[y0:y1, x0:x1], 0)
        if cfg["mono"]:
            rgba[..., :3] = 255
        crop = rgba[by0:by1, bx0:bx1].astype(np.uint8)

        # 정사각형 + 여백 8%
        ch, cw = crop.shape[:2]
        side = int(max(ch, cw) * 1.16)
        canvas = np.zeros((side, side, 4), np.uint8)
        oy, ox = (side - ch) // 2, (side - cw) // 2
        canvas[oy:oy + ch, ox:ox + cw] = crop
        out = Image.fromarray(canvas, "RGBA").convert("RGBa").resize((cfg["size"], cfg["size"]), Image.LANCZOS).convert("RGBA")
        out.save(OUT / f"{name}.png", optimize=True)
        print(f"{sheet:9} {name:22} cell=({x0},{y0},{x1},{y1}) -> {cfg['size']}px")


for sheet, cfg in SHEETS.items():
    export(sheet, cfg)
