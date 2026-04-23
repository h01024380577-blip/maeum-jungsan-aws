#!/usr/bin/env bash
# =====================================================================
# 크레딧 시스템 스모크 테스트 (수동 검증용)
#
# 용도:
#   - Phase 1.c 배포 직후 API 5종이 정상 응답하는지 빠르게 확인
#   - 로컬 개발 시에도 동일하게 사용 가능
#
# 사용법:
#   BASE_URL=https://api.example.com ./scripts/smoke-credits.sh
#   # 또는 로컬:
#   BASE_URL=http://localhost:3000 ./scripts/smoke-credits.sh
#
#   # 인증 모드 (로그인 사용자로 테스트):
#   BASE_URL=... AUTH_TOKEN=<JWT> ./scripts/smoke-credits.sh
#   # 기본은 게스트 모드 (x-user-id 헤더)
#
# 주의:
#   - 실제 광고 load/show는 이 스크립트로 검증 불가 (Toss 앱 필요)
#   - redeem 시점은 실제 광고 시청 후 클라에서만 가능. 여기서는 "nonce 발급까지" 확인.
# =====================================================================

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
DEVICE_ID="${DEVICE_ID:-smoke-test-$(date +%s)}"

auth_header() {
  if [ -n "$AUTH_TOKEN" ]; then
    echo "Authorization: Bearer $AUTH_TOKEN"
  else
    echo "x-user-id: $DEVICE_ID"
  fi
}

pass() { printf "  \033[32m✔\033[0m  %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m  %s\n" "$1"; EXIT_CODE=1; }
info() { printf "  \033[36mℹ\033[0m  %s\n" "$1"; }

EXIT_CODE=0
HDR="$(auth_header)"

echo
echo "[1/5] GET /api/credits — 초기 잔고 조회"
RES=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/credits" -H "$HDR")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
if [ "$CODE" = "200" ]; then
  pass "HTTP 200"
  info "응답: $BODY"
else
  fail "HTTP $CODE (기대 200)  body: $BODY"
fi

echo
echo "[2/5] POST /api/credits/ad-nonce (AI_CREDIT) — 발급"
NONCE_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/credits/ad-nonce" \
  -H "$HDR" \
  -H 'Content-Type: application/json' \
  -d '{"rewardType":"AI_CREDIT","adGroupId":"ait-ad-test-rewarded-id"}')
NONCE_CODE=$(echo "$NONCE_RES" | tail -n1)
NONCE_BODY=$(echo "$NONCE_RES" | sed '$d')
if [ "$NONCE_CODE" = "200" ]; then
  pass "HTTP 200"
  NONCE=$(echo "$NONCE_BODY" | sed -n 's/.*"nonce":"\([^"]*\)".*/\1/p')
  info "nonce=$NONCE"
elif [ "$NONCE_CODE" = "409" ]; then
  info "HTTP 409 — 이미 AI 잔고가 cap에 도달 (정상, 신규 계정 아님)"
  NONCE=""
else
  fail "HTTP $NONCE_CODE (기대 200/409)  body: $NONCE_BODY"
  NONCE=""
fi

echo
echo "[3/5] POST /api/credits/ad-redeem — 잘못된 nonce 거부"
BAD_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/credits/ad-redeem" \
  -H "$HDR" \
  -H 'Content-Type: application/json' \
  -d '{"nonce":"rwd_not_a_real_nonce_value_xxxxxx"}')
BAD_CODE=$(echo "$BAD_RES" | tail -n1)
if [ "$BAD_CODE" = "404" ]; then
  pass "HTTP 404 nonce_not_found (기대대로 거부)"
else
  fail "HTTP $BAD_CODE (기대 404)"
fi

echo
echo "[4/5] POST /api/credits/ad-nonce — 잘못된 rewardType 거부"
INV_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/credits/ad-nonce" \
  -H "$HDR" \
  -H 'Content-Type: application/json' \
  -d '{"rewardType":"MONEY","adGroupId":"test"}')
INV_CODE=$(echo "$INV_RES" | tail -n1)
if [ "$INV_CODE" = "400" ]; then
  pass "HTTP 400 invalid_reward_type (기대대로 거부)"
else
  fail "HTTP $INV_CODE (기대 400)"
fi

echo
echo "[5/5] POST /api/entries/bulk — 빈 배열 거부"
EMPTY_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/entries/bulk" \
  -H "$HDR" \
  -H 'Content-Type: application/json' \
  -d '{"entries":[]}')
EMPTY_CODE=$(echo "$EMPTY_RES" | tail -n1)
if [ "$EMPTY_CODE" = "400" ]; then
  pass "HTTP 400 empty_entries (기대대로 거부)"
else
  fail "HTTP $EMPTY_CODE (기대 400)"
fi

echo
if [ "$EXIT_CODE" = "0" ]; then
  echo "  \033[32m모든 스모크 테스트 통과\033[0m"
else
  echo "  \033[31m일부 검증 실패 — 상단 출력을 확인하세요\033[0m"
fi
exit $EXIT_CODE
