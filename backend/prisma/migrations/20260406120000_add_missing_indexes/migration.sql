-- Add missing indexes for query performance

-- Profile: status-only index (dashboard counts, admin filters)
CREATE INDEX IF NOT EXISTS "profiles_status_idx" ON "profiles"("status");

-- Profile: createdAt index (ordering, date-range queries)
CREATE INDEX IF NOT EXISTS "profiles_createdAt_idx" ON "profiles"("createdAt");

-- Profile: createdById index (team activity, admin filters)
CREATE INDEX IF NOT EXISTS "profiles_createdById_idx" ON "profiles"("createdById");

-- Donation: profileId index (relation lookups)
CREATE INDEX IF NOT EXISTS "donations_profileId_idx" ON "donations"("profileId");

-- Donation: userId index (user donation history)
CREATE INDEX IF NOT EXISTS "donations_userId_idx" ON "donations"("userId");

-- Donation: collectedById index (team collection reports)
CREATE INDEX IF NOT EXISTS "donations_collectedById_idx" ON "donations"("collectedById");
