-- Add height unit support (cm/in) for profiles.
-- Existing rows default to CM.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HeightUnit') THEN
    CREATE TYPE "HeightUnit" AS ENUM ('CM', 'IN', 'FT');
  ELSE
    -- Add FT for existing enum (Postgres supports ADD VALUE; IF NOT EXISTS supported in newer versions)
    BEGIN
      ALTER TYPE "HeightUnit" ADD VALUE IF NOT EXISTS 'FT';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

ALTER TABLE "profiles"
ADD COLUMN IF NOT EXISTS "heightUnit" "HeightUnit" NOT NULL DEFAULT 'CM';

