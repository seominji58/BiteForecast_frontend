"""어종 후보 이미지 → 앱 에셋 (여백 자르기·정사각형·축소·용량 줄이기) + 이미지 연결 파일 생성.

  backend/.venv/bin/python frontend/scripts/process_species_images.py            # 후보 전부
  backend/.venv/bin/python frontend/scripts/process_species_images.py rockfish   # 특정 어종만

- 입력: assets/species/_candidates/<code>.png (생성 원본, git 제외)
- 출력: assets/species/<code>.png (앱 에셋), assets/species/approved.json (적용 기록),
        src/lib/species-images.ts (있는 파일만 require — 없는 어종은 기본 아이콘)
- 그림 내용은 바꾸지 않는다 (자르기·크기만)
"""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "assets" / "species"
CAND = DIR / "_candidates"
SIZE = 384  # 화면 최대 약 112pt @3x 근처, 용량과 선명도 절충
MARGIN = 0.05  # 사방 여백 (긴 변 기준)


def process(code: str) -> dict:
    src = CAND / f"{code}.png"
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 12 else 0)  # 옅은 그림자 테두리는 자르기 기준에서 뺌
    box = alpha.getbbox()
    if box:
        im = im.crop(box)
    w, h = im.size
    side = int(max(w, h) * (1 + 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - w) // 2, (side - h) // 2))
    out = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    dest = DIR / f"{code}.png"
    out.save(dest, optimize=True)
    meta = json.loads((CAND / f"{code}.json").read_text(encoding="utf-8"))
    meta.pop("prompt", None)
    return {
        **meta,
        "asset": f"assets/species/{code}.png",
        "asset_px": SIZE,
        "asset_kb": round(dest.stat().st_size / 1024),
        "applied_at": datetime.now(UTC).isoformat(),
        "review": {**meta.get("review", {}), "status": "applied_pending_user_review"},
    }


def write_map() -> list[str]:
    codes = sorted(p.stem for p in DIR.glob("*.png"))
    lines = [
        "/** 자동 생성 — scripts/process_species_images.py. 직접 고치지 마세요 */",
        "",
        "/** 어종 코드 → 앱 에셋 (require 결과 = 에셋 번호) */",
        "export const SPECIES_IMAGES: Partial<Record<string, number>> = {",
        *[f"  {c}: require('@/assets/species/{c}.png')," for c in codes],
        "};",
        "",
    ]
    (ROOT / "src" / "lib" / "species-images.ts").write_text("\n".join(lines), encoding="utf-8")
    return codes


def main() -> None:
    only = sys.argv[1:]
    ledger_path = DIR / "approved.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8")) if ledger_path.exists() else {}
    for src in sorted(CAND.glob("*.png")):
        code = src.stem
        if only and code not in only:
            continue
        ledger[code] = process(code)
        print(f"{code}: {ledger[code]['asset_kb']}KB")
    ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    codes = write_map()
    print(f"이미지 연결 {len(codes)}종 → src/lib/species-images.ts")


if __name__ == "__main__":
    main()
