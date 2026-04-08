#!/bin/bash
# CSR 빌드용 — API 라우트를 임시 제외하고 정적 HTML 생성
set -e

# API 라우트 임시 이동 (CSR 번들에 불필요)
mv app/api app/_api_ait_backup

# 빌드 실패해도 API 폴더 복원 보장
trap 'mv app/_api_ait_backup app/api' EXIT

NEXT_BUILD_CSR=1 npx next build
