import { Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

const logger = new Logger("ArchivedProfileArchive");

/** Interactive transaction client (or PrismaService) — needs $queryRaw for existence check */
type DbLike = Pick<Prisma.TransactionClient, "$queryRaw" | "archivedProfile">;

export async function archivedProfilesTableExists(db: DbLike): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'archived_profiles'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

export async function archivedProfileCreateManySafe(
  tx: DbLike,
  data: Prisma.ArchivedProfileCreateManyInput[],
  context: string,
): Promise<void> {
  if (data.length === 0) return;
  if (!(await archivedProfilesTableExists(tx))) {
    logger.warn(
      `[${context}] archived_profiles table missing — run migration 20260421170000_add_archived_profiles. ` +
        `Skipping archive of ${data.length} profile(s).`,
    );
    return;
  }
  await tx.archivedProfile.createMany({ data, skipDuplicates: true });
}

export async function archivedProfileCreateSafe(
  tx: DbLike,
  data: Prisma.ArchivedProfileCreateInput,
  context: string,
): Promise<void> {
  if (!(await archivedProfilesTableExists(tx))) {
    logger.warn(
      `[${context}] archived_profiles table missing — run migration 20260421170000_add_archived_profiles. ` +
        `Skipping archive for profile ${data.originalProfileId}.`,
    );
    return;
  }
  await tx.archivedProfile.create({ data });
}
