"""
지마켓산스 OTF → woff2 변환 + 한글 서브셋 (디자인 스펙 §12.3).

- 입력: design/GmarketSansMedium.otf, design/GmarketSansBold.otf (Light는 §12.2 규정상 미사용)
- 출력: public/fonts/gmarket/GmarketSansMedium.woff2, GmarketSansBold.woff2
- 서브셋 범위(Pretendard 다이나믹 서브셋과 동일 계열):
  KS X 1001 완성형 한글 2,350자(EUC-KR 인코딩 가능 음절로 판정) + ASCII + 기본 문장부호
- 실행: scripts/build-gmarket-fonts.sh (venv 부트스트랩 포함) 또는
  fonttools·brotli가 설치된 파이썬에서 직접 `python3 scripts/build-gmarket-fonts.py`
- 산출물은 저장소에 커밋한다(빌드 시 재변환 불필요 — impl 문서 §11 참조).
"""

from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "design"
OUT_DIR = ROOT / "public" / "fonts" / "gmarket"

# §12.2: Medium(500)·Bold(700)만 서빙, Light(300)는 판독성 사유로 전면 미사용
WEIGHTS = ["GmarketSansMedium", "GmarketSansBold"]


def build_unicode_set() -> set[int]:
    codepoints: set[int] = set()

    # ASCII (라틴·숫자·기본 문장부호)
    codepoints.update(range(0x0020, 0x007F))

    # 한글 텍스트에서 통용되는 기본 문장부호·기호
    extras = [
        0x00A9,  # ©
        0x00B7,  # · (가운뎃점)
        0x2013, 0x2014, 0x2015,  # 대시류
        0x2018, 0x2019, 0x201C, 0x201D,  # 따옴표
        0x2026,  # …
        0x3001, 0x3002,  # 、。
        0x300C, 0x300D, 0x300E, 0x300F,  # 낫표
        0x3008, 0x3009, 0x300A, 0x300B,  # 홑화살괄호·겹화살괄호
    ]
    codepoints.update(extras)

    # KS X 1001 완성형 한글 2,350자 — EUC-KR에서 2바이트로 인코딩되는 음절만.
    # (CPython euc_kr 코덱은 비완성형 음절도 8바이트 조합형으로 인코딩하므로
    #  길이 2 여부로 완성형을 판정한다)
    for cp in range(0xAC00, 0xD7A4):
        try:
            encoded = chr(cp).encode("euc_kr")
        except UnicodeEncodeError:
            continue
        if len(encoded) == 2:
            codepoints.add(cp)

    return codepoints


def subset_font(name: str, unicodes: set[int]) -> None:
    src = SRC_DIR / f"{name}.otf"
    dest = OUT_DIR / f"{name}.woff2"

    font = TTFont(str(src))
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # 기본 레이아웃 피처 유지 (커닝 등)
    options.name_IDs = ["*"]  # 라이선스·저작권 name 레코드 보존 (OFL 준수)
    options.notdef_outline = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=sorted(unicodes))
    subsetter.subset(font)

    # QA 7회차 수정: Options.flavor는 subset CLI 경로에서만 쓰이므로
    # TTFont.save()가 woff2로 압축하려면 font.flavor를 직접 설정해야 한다.
    font.flavor = "woff2"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    font.save(str(dest))

    src_kb = src.stat().st_size / 1024
    dest_kb = dest.stat().st_size / 1024
    glyphs = font["maxp"].numGlyphs
    print(f"[gmarket] {name}: {src_kb:.0f}KB (OTF) -> {dest_kb:.0f}KB (woff2), glyphs={glyphs}")


def main() -> None:
    unicodes = build_unicode_set()
    hangul = sum(1 for cp in unicodes if 0xAC00 <= cp <= 0xD7A3)
    print(f"[gmarket] subset codepoints={len(unicodes)} (hangul {hangul})")
    for name in WEIGHTS:
        subset_font(name, unicodes)


if __name__ == "__main__":
    main()
