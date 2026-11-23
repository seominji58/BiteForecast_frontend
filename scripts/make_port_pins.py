"""지도 출항항 핀: 닻 그림 (2026-11-23).

낚시터 묶음 핀(남색 원 + 숫자)과 헷갈리지 않게 「둥근 사각형 + 흰 닻」 모양으로 따로 만든다.
척수는 그림이 아니라 카카오 라벨 글자(핀 아래 「93척」)로 쓴다.
결과: assets/map/port.png (청록), assets/map/port-selected.png (주황)
실행: python3 scripts/make_port_pins.py   (frontend 폴더에서, Pillow 필요)
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "map"
S = 4  # 크게 그려서 줄인다 (가장자리 매끄럽게)
SIZE = 96  # 화면 32pt × 3배


def anchor_pin(rgb: tuple[int, int, int]) -> Image.Image:
    n = SIZE * S
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = 6 * S
    d.rounded_rectangle([pad, pad, n - pad, n - pad], radius=22 * S, fill=(255, 255, 255, 255))
    b = pad + 5 * S
    d.rounded_rectangle([b, b, n - b, n - b], radius=18 * S, fill=rgb + (255,))
    w = (255, 255, 255, 255)
    cx = n // 2
    lw = 7 * S
    # 고리
    r = 9 * S
    top = n * 0.24
    d.ellipse([cx - r, top - r, cx + r, top + r], outline=w, width=lw)
    # 기둥
    d.line([cx, top + r, cx, n * 0.76], fill=w, width=lw)
    # 가로대
    d.line([cx - 17 * S, n * 0.40, cx + 17 * S, n * 0.40], fill=w, width=lw)
    # 아래 갈고리 (호)
    ar = 24 * S
    acy = n * 0.56
    d.arc([cx - ar, acy - ar, cx + ar, acy + ar], start=20, end=160, fill=w, width=lw)
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    anchor_pin((15, 118, 110)).save(OUT / "port.png", optimize=True)  # 청록 #0F766E
    anchor_pin((249, 115, 22)).save(OUT / "port-selected.png", optimize=True)  # 주황 #F97316
    print("port.png, port-selected.png")


if __name__ == "__main__":
    main()
