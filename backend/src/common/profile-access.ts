/**
 * Profile access-gate helpers.
 *
 * Business rule:
 * - End-users (role=USER) must pay ₹2100 to view full profiles.
 * - Once paid, access is valid for 6 months (accessExpiresAt).
 * - TEAM / MANAGER / ADMIN always see full profiles.
 * - A user always sees their OWN profile in full.
 *
 * When a viewer is "locked", the backend strips all profile fields
 * EXCEPT the public teaser set: name, age (DOB), father's name,
 * mother's name, occupation (profession + professionDetails), caste.
 * Everything else (photo, mobile, address, education, income, family,
 * etc.) is returned as `null` and the response includes `_locked: true`
 * so the frontend can render an "Unlock with ₹2100" call-to-action.
 */

import { PrismaService } from './prisma.service';

export type ViewerRole = 'USER' | 'TEAM' | 'MANAGER' | 'ADMIN' | string;

export interface AccessViewer {
  userId: string;
  role: ViewerRole;
  hasPaidAccess: boolean;
  accessExpiresAt: Date | null;
}

/** Fields that remain visible when the viewer has NOT paid the access fee. */
export const VISIBLE_FIELDS_WHEN_LOCKED = new Set<string>([
  // identifiers
  'id',
  'registrationNumber',
  'status',
  'gender',
  // teaser fields
  'fullName',
  'dateOfBirth', // age computed from this on the frontend
  'fatherName',
  'motherName',
  'profession',
  'professionDetails',
  'caste',
]);

/** Roles that always see full profiles regardless of payment. */
export const STAFF_ROLES = new Set<ViewerRole>(['TEAM', 'MANAGER', 'ADMIN']);

/** Load viewer's role + access flags from DB (cheap — small select). */
export async function loadViewerAccess(
  prisma: PrismaService,
  userId: string,
): Promise<AccessViewer> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, hasPaidAccess: true, accessExpiresAt: true },
  });
  if (!u) {
    return { userId, role: 'USER', hasPaidAccess: false, accessExpiresAt: null };
  }
  return {
    userId: u.id,
    role: u.role as ViewerRole,
    hasPaidAccess: !!u.hasPaidAccess,
    accessExpiresAt: u.accessExpiresAt ?? null,
  };
}

/** True if viewer has currently-valid paid access. */
export function hasActiveAccess(viewer: Pick<AccessViewer, 'hasPaidAccess' | 'accessExpiresAt'>): boolean {
  if (!viewer.hasPaidAccess) return false;
  if (!viewer.accessExpiresAt) return false;
  return viewer.accessExpiresAt.getTime() > Date.now();
}

/** True if the viewer can see ALL fields of the profile. */
export function canViewFullProfile(
  viewer: AccessViewer,
  profileOwnerUserId: string | null | undefined,
): boolean {
  if (STAFF_ROLES.has(viewer.role)) return true;
  if (profileOwnerUserId && profileOwnerUserId === viewer.userId) return true;
  return hasActiveAccess(viewer);
}

/**
 * Returns a shallow copy of the profile with locked fields nulled out.
 * Adds `_locked: true` (consumed by the frontend).
 */
export function maskProfile<T extends Record<string, unknown>>(profile: T): T & { _locked: true } {
  const masked: Record<string, unknown> = {};
  for (const key of Object.keys(profile)) {
    masked[key] = VISIBLE_FIELDS_WHEN_LOCKED.has(key) ? profile[key] : null;
  }
  masked._locked = true;
  return masked as T & { _locked: true };
}

/** Apply masking only if the viewer cannot see the full profile. */
export function applyMaskIfLocked<T extends Record<string, unknown> & { userId?: string | null }>(
  profile: T,
  viewer: AccessViewer,
): T | (T & { _locked: true }) {
  if (canViewFullProfile(viewer, profile.userId ?? null)) return profile;
  return maskProfile(profile);
}
