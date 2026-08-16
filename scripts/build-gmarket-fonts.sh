#!/usr/bin/env bash
# 지마켓산스 웹폰트 변환 재현 스크립트 (디자인 스펙 §12.3).
# 임시 venv에 fonttools+brotli를 설치해 build-gmarket-fonts.py를 실행한다.
# (macOS 시스템 파이썬의 PEP 668 externally-managed 제약 우회 — 시스템 오염 없음)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$(mktemp -d)/font-venv"

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet "fonttools>=4.50" "brotli>=1.1"
"$VENV_DIR/bin/python" "$SCRIPT_DIR/build-gmarket-fonts.py"

rm -rf "$(dirname "$VENV_DIR")"
echo "[gmarket] 완료 — public/fonts/gmarket/ (산출물은 커밋 대상)"
