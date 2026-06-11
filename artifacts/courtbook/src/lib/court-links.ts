/**
 * Builds the player-facing link for a court: the facility+sport group page
 * (the booking front door) when facility data is available, otherwise the
 * legacy /courts/:id detail page. Centralized so the legacy fallback can be
 * removed in one place when /courts is retired.
 */
export function courtGroupHref(court: { id: number; facilityId?: number | null; type?: string | null }): string {
  if (court.facilityId != null && court.type) {
    return `/facility/${court.facilityId}?sport=${court.type.replace(/-/g, "_")}`;
  }
  return `/courts/${court.id}`;
}
