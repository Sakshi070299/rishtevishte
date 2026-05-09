ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "internalRegistrationNo" TEXT;

CREATE INDEX IF NOT EXISTS "profiles_internalRegistrationNo_idx"
ON "profiles" ("internalRegistrationNo");
