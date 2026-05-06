/**
 * Facility verification "Gatekeeper" — single source of truth for which
 * verification stage a facility is allowed to be in, and what minimum data
 * the owner must supply before they can leave the 'draft' stage.
 *
 * Stages:
 *   draft                → Owner is still editing; not visible to public.
 *   pending_verification → Info complete + owner Stripe ready; awaiting admin approval.
 *   active               → Admin-approved AND owner Stripe-ready; visible in search.
 *   suspended            → Manually disabled by admin.
 *
 * Stripe Connect lives on the OWNER's user_profiles row. The submit endpoint
 * refuses the transition draft → pending_verification when the owner has not
 * connected Stripe; there is no per-facility "onboarding" status.
 */
import type { Facility } from "@workspace/db";

export type FacilityStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "suspended";

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Validate whether a facility has the minimum data required to enter the
 * verification queue. Intentionally lean:
 *   - name, address, city — core identity that an admin needs to review the facility
 *   - coordinates are NOT required (text address is sufficient; owner may not use the map picker)
 *   - photos are NOT required here (facility-level photos are optional; court photos
 *     are uploaded per-court and are what players actually see)
 */
export function validateForVerification(
  facility: Pick<Facility, "name" | "address" | "city">,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!facility.name || facility.name.trim().length < 2) {
    issues.push({ field: "name", message: "Pavadinimas privalomas (bent 2 simboliai)." });
  }

  if (!facility.address || facility.address.trim().length < 3) {
    issues.push({ field: "address", message: "Reikalingas pilnas adresas." });
  }

  if (!facility.city || facility.city.trim().length < 2) {
    issues.push({ field: "city", message: "Reikalingas miestas." });
  }

  return issues;
}

/**
 * Strict Stripe Connect readiness predicate. A Connect account is only
 * considered "ready" — i.e. safe to mark the facility live and accept money —
 * when ALL of these are true:
 *   - details_submitted: owner finished onboarding form
 *   - charges_enabled: Stripe will actually accept payments
 *   - payouts_enabled: Stripe will actually pay the owner
 *   - requirements.disabled_reason is empty: no restriction or hold
 *
 * Used in: stripe webhook (account.updated), /stripe/connect/status,
 * facility submit-for-verification, and the admin approval gate (transitively
 * via the owner profile's `stripeAccountStatus`).
 */
export interface StripeReadinessInput {
  details_submitted?: boolean | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  requirements?: { disabled_reason?: string | null } | null;
}

export function isStripeAccountReady(account: StripeReadinessInput | null | undefined): boolean {
  if (!account) return false;
  return (
    account.details_submitted === true &&
    account.charges_enabled === true &&
    account.payouts_enabled === true &&
    !account.requirements?.disabled_reason
  );
}

/** Public-facing labels (Lithuanian). */
export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  draft: "Juodraštis",
  pending_verification: "Laukiama patvirtinimo",
  active: "Aktyvus",
  suspended: "Sustabdytas",
};
