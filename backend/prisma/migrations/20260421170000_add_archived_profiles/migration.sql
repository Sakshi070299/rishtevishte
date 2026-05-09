CREATE TABLE IF NOT EXISTS "archived_profiles" (
  "id" TEXT NOT NULL,
  "originalProfileId" TEXT NOT NULL,
  "userId" TEXT,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "archived_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "archived_profiles_originalProfileId_key"
ON "archived_profiles"("originalProfileId");

CREATE INDEX IF NOT EXISTS "archived_profiles_userId_idx"
ON "archived_profiles"("userId");

CREATE INDEX IF NOT EXISTS "archived_profiles_archivedAt_idx"
ON "archived_profiles"("archivedAt");

