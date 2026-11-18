"""지도 어종 핀 그림 만들기 (2026-11-18, 지도 핀 설계 1단계).

어종 그림(assets/species/*.png)마다 테두리 색 3가지 핀을 만든다.
  - good   : 초록  — 고른 어종 공식 낚시지수 「좋음」 이상
  - normal : 회색  — 「보통」 또는 지수 정보 없음
  - bad    : 빨강  — 「나쁨」 이하 또는 해상특보 발효
그리고 핀 오른쪽 위에 붙는 표시:
  - badge-catch.png : 주황 점 (최근 14일 이용자 조황) — 카카오 라벨 배지로 붙인다
묶음 개수(「좋음 12」)는 그림이 아니라 카카오 라벨 글자(핀 아래)로 쓴다.
결과: assets/map/pins/<code>-<ring>.png, assets/map/badge-catch.png, src/components/map/pin-assets.ts

실행: python3 scripts/make_map_pins.py   (frontend 폴더에서)
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SPECIES = ROOT / "assets" / "species"
OUT = ROOT / "assets" / "map" / "pins"
TS = ROOT / "src" / "components" / "map" / "pin-assets.ts"

SIZE = 132  # 화면에서는 44pt (3배)
RING = 9
RINGS = {"good": (22, 163, 74), "normal": (100, 116, 139), "bad": (220, 38, 38)}


def fish_icon(src: Path, box: int) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((box, box), Image.LANCZOS, reducing_gap=3.0)
    return im


def pin(fish: Image.Image, ring_rgb: tuple[int, int, int]) -> Image.Image:
    s = 4  # 4배로 그려서 줄여 가장자리를 매끄럽게
    big = Image.new("RGBA", (SIZE * s, SIZE * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    pad = 2 * s
    d.ellipse([pad, pad, SIZE * s - pad, SIZE * s - pad], fill=(255, 255, 255, 255), outline=ring_rgb + (255,), width=RING * s)
    out = big.resize((SIZE, SIZE), Image.LANCZOS)
    out.alpha_composite(fish, ((SIZE - fish.width) // 2, (SIZE - fish.height) // 2))
    return out


def badge_catch() -> Image.Image:
    s, n = 4, 48
    big = Image.new("RGBA", (n * s, n * s), (0, 0, 0, 0))
    ImageDraw.Draw(big).ellipse([3 * s, 3 * s, (n - 3) * s, (n - 3) * s], fill=(249, 115, 22, 255), outline=(255, 255, 255, 255), width=6 * s)
    return big.resize((n, n), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    codes = sorted(p.stem for p in SPECIES.glob("*.png"))
    for code in codes:
        fish = fish_icon(SPECIES / f"{code}.png", SIZE - 2 * RING - 26)
        for ring, rgb in RINGS.items():
            pin(fish, rgb).save(OUT / f"{code}-{ring}.png", optimize=True)
    badge_catch().save(OUT.parent / "badge-catch.png", optimize=True)

    lines = [
        "/* 자동 생성: scripts/make_map_pins.py — 직접 고치지 말 것 */",
        "export type PinRing = 'good' | 'normal' | 'bad';",
        "",
        "/** 어종 핀 (흰 원 + 어종 그림 + 테두리 색 = 공식 지수 등급) */",
        "export const PIN: Record<string, Record<PinRing, number>> = {",
    ]
    for code in codes:
        lines.append(f"  {code}: {{")
        for ring in RINGS:
            lines.append(f"    {ring}: require('@/assets/map/pins/{code}-{ring}.png'),")
        lines.append("  },")
    lines += [
        "};",
        "",
        "/** 최근 이용자 조황 주황 점 (핀 오른쪽 위 배지) */",
        "export const BADGE_CATCH: number = require('@/assets/map/badge-catch.png');",
        "",
    ]
    TS.write_text("\n".join(lines), encoding="utf-8")
    total = sum(f.stat().st_size for f in OUT.glob("*.png"))
    print(f"{len(codes)}종 × {len(RINGS)} = {len(codes) * len(RINGS)}개, {total // 1024}KB")


if __name__ == "__main__":
    main()
