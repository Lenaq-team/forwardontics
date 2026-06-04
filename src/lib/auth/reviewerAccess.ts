/**
 * Reviewer access and limits.
 * - "Reviewer" / "Admin": REVIEWER_ACCESS_PERIOD_DAYS, REVIEWER_MAX_PATIENTS (e.g. 500 days, 20 patients).
 * - "Reviewer-test": REVIEWER_TEST_ACCESS_PERIOD_DAYS, REVIEWER_TEST_MAX_PATIENTS (e.g. 180 days, 5 patients).
 */

const REVIEWER_TEST_GROUP = "Reviewer-test";

export function canAccessReviewer(groups: string[]): boolean {
  return (
    groups.includes("Reviewer") ||
    groups.includes("Admin") ||
    groups.includes(REVIEWER_TEST_GROUP)
  );
}

/** True if user is only in Reviewer-test (trial reviewer), not Admin/Reviewer. */
export function isReviewerTest(groups: string[]): boolean {
  return (
    groups.includes(REVIEWER_TEST_GROUP) &&
    !groups.includes("Reviewer") &&
    !groups.includes("Admin")
  );
}

/** True if user is Reviewer or Admin (standard reviewer). */
export function isReviewerOrAdmin(groups: string[]): boolean {
  return groups.includes("Reviewer") || groups.includes("Admin");
}

/** Limits for standard Reviewer/Admin: REVIEWER_ACCESS_PERIOD_DAYS, REVIEWER_MAX_PATIENTS. */
export function getReviewerLimits(): {
  accessPeriodDays: number;
  maxPatients: number;
} {
  const accessPeriodDays =
    parseInt(
      process.env.REVIEWER_ACCESS_PERIOD_DAYS ?? "500",
      10
    ) || 500;
  const maxPatients =
    parseInt(process.env.REVIEWER_MAX_PATIENTS ?? "20", 10) || 20;
  return { accessPeriodDays, maxPatients };
}

/** Limits for Reviewer-test: REVIEWER_TEST_ACCESS_PERIOD_DAYS, REVIEWER_TEST_MAX_PATIENTS. */
export function getReviewerTestLimits(): {
  accessPeriodDays: number;
  maxPatients: number;
} {
  const accessPeriodDays =
    parseInt(
      process.env.REVIEWER_TEST_ACCESS_PERIOD_DAYS ?? "180",
      10
    ) || 180;
  const maxPatients =
    parseInt(process.env.REVIEWER_TEST_MAX_PATIENTS ?? "5", 10) || 5;
  return { accessPeriodDays, maxPatients };
}

/** Limits for the current user based on groups (Reviewer/Admin vs Reviewer-test). */
export function getLimitsForGroups(groups: string[]): {
  accessPeriodDays: number;
  maxPatients: number;
} | null {
  if (!canAccessReviewer(groups)) return null;
  if (isReviewerTest(groups)) return getReviewerTestLimits();
  if (isReviewerOrAdmin(groups)) return getReviewerLimits();
  return null;
}

/** Enforce membership expiry for both Reviewer and Reviewer-test (both use access period from env). */
export function shouldEnforceMembership(groups: string[]): boolean {
  return canAccessReviewer(groups);
}
