CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'INVALIDATED');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "mobile" VARCHAR(16) NOT NULL,
  "displayName" VARCHAR(40) NOT NULL,
  "bestScore" INTEGER NOT NULL DEFAULT 0,
  "bestScoredAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpChallenge" (
  "id" UUID NOT NULL,
  "mobile" VARCHAR(16) NOT NULL,
  "displayName" VARCHAR(40),
  "codeHash" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "userAgent" VARCHAR(500),
  "ipAddress" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "seed" INTEGER NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "finishedAt" TIMESTAMPTZ(3),
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "validationVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameHit" (
  "id" UUID NOT NULL,
  "gameSessionId" UUID NOT NULL,
  "targetId" INTEGER NOT NULL,
  "hitAtMs" INTEGER NOT NULL,
  "swipeDistance" DOUBLE PRECISION NOT NULL,
  "swipeDurationMs" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameHit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");
CREATE INDEX "User_bestScore_bestScoredAt_idx" ON "User"("bestScore", "bestScoredAt");
CREATE INDEX "OtpChallenge_mobile_createdAt_idx" ON "OtpChallenge"("mobile", "createdAt");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX "GameSession_userId_status_idx" ON "GameSession"("userId", "status");
CREATE INDEX "GameSession_createdAt_idx" ON "GameSession"("createdAt");
CREATE UNIQUE INDEX "GameHit_gameSessionId_targetId_key" ON "GameHit"("gameSessionId", "targetId");
CREATE INDEX "GameHit_gameSessionId_idx" ON "GameHit"("gameSessionId");

ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameHit" ADD CONSTRAINT "GameHit_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
