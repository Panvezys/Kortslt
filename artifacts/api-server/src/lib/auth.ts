import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

/** Clerk userIds that have admin access, comma-separated in ADMIN_USER_IDS env var */
function getAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(raw.split(",").map(s => s.trim()).filter(Boolean));
}

/** Express middleware: requires request to carry a valid Clerk session */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/** Express middleware: requires the caller to be listed in ADMIN_USER_IDS */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId || !getAdminIds().has(userId)) {
    res.status(403).json({ error: "Forbidden – admin only" });
    return;
  }
  next();
}

/** Returns true if the current request's userId matches the court owner */
export function isOwner(req: Request, ownerUserId: string | null | undefined, ownerEmail?: string): boolean {
  const { userId } = getAuth(req);
  if (!userId) return false;
  if (ownerUserId) return ownerUserId === userId;
  // Fallback for legacy courts without ownerUserId: use email if clerk provides it
  return false;
}

export function getCurrentUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}
