CREATE TYPE "AuthMode" AS ENUM ('LOGIN', 'REGISTER');

ALTER TABLE "User"
ADD COLUMN "referralCode" VARCHAR(12),
ADD COLUMN "referredById" UUID,
ADD COLUMN "totalGameScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "referralPoints" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "referralCode" = UPPER(SUBSTRING(MD5("id"::text), 1, 12));

UPDATE "User" AS target
SET "totalGameScore" = COALESCE((
  SELECT SUM(game."score")
  FROM "GameSession" AS game
  WHERE game."userId" = target."id"
    AND game."status" = 'COMPLETED'
), 0);

ALTER TABLE "User"
ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

ALTER TABLE "User"
ADD CONSTRAINT "User_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OtpChallenge"
ADD COLUMN "authMode" "AuthMode" NOT NULL DEFAULT 'REGISTER',
ADD COLUMN "referrerId" UUID;

ALTER TABLE "GameSession"
ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "claimTokenHash" CHAR(64),
ADD COLUMN "claimExpiresAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "GameSession_claimTokenHash_key"
ON "GameSession"("claimTokenHash");

ALTER TABLE "GameSession"
DROP CONSTRAINT "GameSession_userId_fkey";

ALTER TABLE "GameSession"
ADD CONSTRAINT "GameSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralReward" (
  "id" UUID NOT NULL,
  "referrerId" UUID NOT NULL,
  "referredUserId" UUID NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralReward_referredUserId_key"
ON "ReferralReward"("referredUserId");

CREATE INDEX "ReferralReward_referrerId_createdAt_idx"
ON "ReferralReward"("referrerId", "createdAt");

ALTER TABLE "ReferralReward"
ADD CONSTRAINT "ReferralReward_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
ADD CONSTRAINT "ReferralReward_referredUserId_fkey"
FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
