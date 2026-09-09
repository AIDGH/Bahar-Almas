CREATE TABLE "OtpRateLimit" (
  "mobile" VARCHAR(16) NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "blockedUntil" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OtpRateLimit_pkey" PRIMARY KEY ("mobile")
);
