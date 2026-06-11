/**
 * Builds the player-facing link for a court: the facility+sport group page
 * (the booking front door). Courts without facility data fall back to /explore
 * — the legacy /courts/:id page has been removed.
 */
export function courtGroupHref(court: { id: number; facilityId?: number | null; type?: string | null }): string {
  if (court.facilityId != null && court.type) {
    return `/facility/${court.facilityId}?sport=${court.type.replace(/-/g, "_")}`;
  }
  return "/explore";
}
