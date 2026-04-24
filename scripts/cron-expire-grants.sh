#!/bin/bash
# 만료된 AdRewardGrant(ISSUED) 레코드를 EXPIRED로 전환
# EC2 crontab에서 10분 간격 실행 권장
# crontab 등록: */10 * * * * /bin/bash /home/ec2-user/maeum-jungsan-aws/scripts/cron-expire-grants.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

if [ -z "$CRON_SECRET" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: CRON_SECRET is not set" >&2
  exit 1
fi

APP_PORT="${APP_PORT:-3000}"
API_URL="http://localhost:${APP_PORT}/api/cron/expire-grants"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "$API_URL")

HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] HTTP $HTTP_CODE — $HTTP_BODY"

if [ "$HTTP_CODE" != "200" ]; then
  exit 1
fi
