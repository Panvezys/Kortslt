// Helpers for guest-booking management tokens.
// All comparisons must be timing-safe: tokens authorize publicly-reachable
// endpoints (cancel/confirm/refund) so naive `===` would leak character-by-
// character timing information about valid tokens.

import { timingSafeEqual } from "node:crypto";

// Defensive guard: block tokens that are obviously not real to avoid wasting
// DB queries (and to make timing-attack discovery slightly harder).
export function isPlausibleToken(token: string | undefined | null): token is string {
  return typeof token === "string" && token.length >= 16 && token.length <= 128;
}

// Constant-time token equality. `a` is the user-supplied value; `b` is the
// expected token from the DB. Returns false fast if either side is missing or
// lengths differ (length-mismatch alone is not a secret leak — the prefix
// space of valid tokens is fixed by `randomBytes(32).toString("base64url")`).
export function timingSafeEqualToken(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
