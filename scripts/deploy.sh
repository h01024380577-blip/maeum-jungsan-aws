#!/bin/bash
# 자동 배포 스크립트: push → EC2 pull + rebuild + restart (+ AIT 번들 재생성)
set -e

EC2_HOST=kmuproj-maeum-jungsan
EC2_DIR=~/maeum-jungsan-aws
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- 1. Git push ---
echo "📤 Pushing to remote..."
cd "$LOCAL_DIR"
git push aws main

# --- 2. EC2 pull + build + restart ---
echo "🖥️  Updating EC2 server..."
ssh "$EC2_HOST" "cd $EC2_DIR && git pull origin main && npx prisma generate && npm run build:next 2>&1 | tail -3 && pm2 restart maeum-jungsan"

# --- 3. AIT 번들 재생성 (클라이언트 변경 시) ---
# 최근 커밋에서 클라이언트 파일 변경 여부 확인
CLIENT_CHANGED=$(git diff HEAD~1 --name-only -- \
  'src/**' 'components/**' 'app/**/*.tsx' 'app/**/*.ts' \
  '!app/api/**' \
  'public/**' 'styles/**' | head -1)

if [ -n "$CLIENT_CHANGED" ]; then
  echo "📱 Client changes detected — rebuilding AIT bundle..."
  cd "$LOCAL_DIR"
  rm -rf dist
  npm run build:ait
  echo "✅ AIT bundle rebuilt at dist/web/"
  echo "👉 granite deploy (또는 ait deploy)로 번들을 업로드하세요"
else
  echo "⏭️  No client changes — skipping AIT bundle rebuild"
fi

echo "🎉 Deploy complete!"
