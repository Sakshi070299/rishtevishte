-- Add structured split-payment columns (replaces JSON in `notes`).

ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitCashRupees" INTEGER;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitOnlineRupees" INTEGER;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitFreeRupees" INTEGER;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitFreeApprovedBy" TEXT;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitFreeReason" TEXT;

-- Prisma @default([]) for String[]
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "splitPaymentMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy `notes` JSON (skip invalid rows)
DO $$
DECLARE
  r RECORD;
  j jsonb;
  pm text[];
BEGIN
  FOR r IN SELECT id, notes FROM "donations" WHERE notes IS NOT NULL AND btrim(notes) <> ''
  LOOP
    BEGIN
      j := r.notes::jsonb;
      pm := CASE
        WHEN j ? 'paymentMethods' AND jsonb_typeof(j->'paymentMethods') = 'array'
        THEN COALESCE(
          (SELECT array_agg(e) FROM jsonb_array_elements_text(j->'paymentMethods') AS e),
          ARRAY[]::text[]
        )
        ELSE ARRAY[]::text[]
      END;

      UPDATE "donations"
      SET
        "splitCashRupees" = CASE
          WHEN j ? 'cashAmount' AND (j->>'cashAmount') ~ '^[0-9]+$' THEN (j->>'cashAmount')::int
          ELSE NULL
        END,
        "splitOnlineRupees" = CASE
          WHEN j ? 'onlineAmount' AND (j->>'onlineAmount') ~ '^[0-9]+$' THEN (j->>'onlineAmount')::int
          ELSE NULL
        END,
        "splitFreeRupees" = CASE
          WHEN j ? 'freeAmount' AND (j->>'freeAmount') ~ '^[0-9]+$' THEN (j->>'freeAmount')::int
          ELSE NULL
        END,
        "splitFreeApprovedBy" = NULLIF(j->>'freeApprovedBy', ''),
        "splitFreeReason" = NULLIF(j->>'freeReason', ''),
        "splitPaymentMethods" = pm
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE "donations" DROP COLUMN IF EXISTS "notes";
