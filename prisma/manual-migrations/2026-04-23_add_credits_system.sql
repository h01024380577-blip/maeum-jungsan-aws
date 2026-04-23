-- =====================================================================
-- 크레딧 시스템 도입 마이그레이션 (2026-04-23)
-- =====================================================================
-- 적용 대상 DB: Supabase PostgreSQL (ap-southeast-2, HeartBook 프로덕션)
--
-- 이 파일은 Prisma가 자동 실행하지 않는다. 다음 중 한 가지 방식으로 반영:
--   (A) psql 세션 풀러 직접 실행:  psql "$DIRECT_URL" -f <이 파일>
--   (B) Supabase Studio SQL Editor에 붙여넣기
--   (C) DB 관리자 도구 (DBeaver/TablePlus 등)에서 실행
--
-- 실행 전 확인:
--   1) 백업 스냅샷이 최근 1일 이내로 존재하는가
--   2) 아래 BEGIN/COMMIT 블록을 그대로 사용 (원자 적용)
-- =====================================================================

BEGIN;

-- 1) enum 신설 -------------------------------------------------------
CREATE TYPE "RewardType" AS ENUM ('AI_CREDIT', 'CSV_CREDIT');
CREATE TYPE "GrantStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'REJECTED');

-- 2) User에 크레딧/광고 카운터 컬럼 추가 -----------------------------
-- 기존 사용자에게는 웰컴 크레딧(AI 5, CSV 1)이 DEFAULT로 소급 지급됨
ALTER TABLE "User"
  ADD COLUMN "aiCredits"        INTEGER   NOT NULL DEFAULT 5,
  ADD COLUMN "csvImportCredits" INTEGER   NOT NULL DEFAULT 1,
  ADD COLUMN "adWatchesToday"   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN "adWatchesResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) AdRewardGrant 테이블 신설 --------------------------------------
CREATE TABLE "AdRewardGrant" (
  "id"           TEXT          NOT NULL,
  "userId"       TEXT          NOT NULL,
  "adGroupId"    TEXT          NOT NULL,
  "rewardNonce"  TEXT          NOT NULL,
  "rewardType"   "RewardType"  NOT NULL,
  "rewardAmount" INTEGER       NOT NULL,
  "status"       "GrantStatus" NOT NULL DEFAULT 'ISSUED',
  "issuedAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt"   TIMESTAMP(3),
  "expiresAt"    TIMESTAMP(3)  NOT NULL,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  CONSTRAINT "AdRewardGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdRewardGrant_rewardNonce_key"
  ON "AdRewardGrant"("rewardNonce");

CREATE INDEX "AdRewardGrant_userId_idx"
  ON "AdRewardGrant"("userId");

CREATE INDEX "AdRewardGrant_issuedAt_idx"
  ON "AdRewardGrant"("issuedAt");

CREATE INDEX "AdRewardGrant_userId_rewardType_idx"
  ON "AdRewardGrant"("userId", "rewardType");

ALTER TABLE "AdRewardGrant"
  ADD CONSTRAINT "AdRewardGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- =====================================================================
-- 롤백 (필요 시 별도 트랜잭션으로 실행)
-- =====================================================================
-- BEGIN;
--   DROP TABLE "AdRewardGrant";
--   ALTER TABLE "User"
--     DROP COLUMN "aiCredits",
--     DROP COLUMN "csvImportCredits",
--     DROP COLUMN "adWatchesToday",
--     DROP COLUMN "adWatchesResetAt";
--   DROP TYPE "GrantStatus";
--   DROP TYPE "RewardType";
-- COMMIT;
