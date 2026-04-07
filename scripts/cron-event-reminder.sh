#!/bin/bash
# 경조사 당일 리마인드 푸시 알림 발송 스크립트
# EC2 crontab에서 매일 오전 9시(KST)에 실행
# crontab 등록: 0 0 * * * /bin/bash /path/to/maeum-jungsan/scripts/cron-event-reminder.sh

# .env 파일에서 환경변수 로드
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

# 필수 변수 확인
if [ -z "$CRON_SECRET" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: CRON_SECRET is not set" >&2
  exit 1
fi

APP_PORT="${APP_PORT:-3000}"
API_URL="http://localhost:${APP_PORT}/api/cron/event-reminder"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Calling event-reminder cron..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "$API_URL")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] HTTP $HTTP_CODE — $HTTP_BODY"

if [ "$HTTP_CODE" != "200" ]; then
  exit 1
fi
