CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bannedAt" TIMESTAMPTZ(3);

CREATE INDEX "User_isBanned_bestScore_bestScoredAt_idx"
ON "User"("isBanned", "bestScore", "bestScoredAt");
