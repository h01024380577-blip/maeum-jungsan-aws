#!/bin/bash
# 자동 배포 스크립트: push → EC2 pull + rebuild + restart (+ AIT 번들 재생성)
set -e

EC2_HOST=kmuproj-maeum-jungsan
# Remote 경로 — 로컬에서 ~ 확장 방지 위해 $HOME 사용
EC2_DIR='$HOME/maeum-jungsan-aws'
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- 1. Git push ---
echo "📤 Pushing to remote..."
cd "$LOCAL_DIR"
git push aws main

# --- 2. EC2 pull + install + build + restart ---
# npm install: package-lock 변경(신규 의존성) 대응. 변경 없으면 빠르게 패스.
# pm2 --update-env: .env 파일 변경도 프로세스에 반영되도록 강제.
echo "🖥️  Updating EC2 server..."
ssh "$EC2_HOST" "cd $EC2_DIR && git pull origin main && npm install --legacy-peer-deps 2>&1 | tail -3 && npx prisma generate && npm run build:next 2>&1 | tail -3 && set -a && source .env && set +a && pm2 restart maeum-jungsan --update-env"

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
  echo "📦 Packaging .ait artifact..."
  npx ait build
  echo "✅ AIT artifact rebuilt (maeum-jungsan.ait)"
  echo "👉 npx ait deploy 로 번들을 업로드하세요"
else
  echo "⏭️  No client changes — skipping AIT bundle rebuild"
fi

echo "🎉 Deploy complete!"
