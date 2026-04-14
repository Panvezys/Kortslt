import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userRolesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@workspace/db/schema";

/** IDs in ADMIN_USER_IDS env var always get admin role, even if DB says otherwise */
const HARDCODED_ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)
);

/** Fetch a user's role from DB; returns 'player' if no row exists.
 *  Users listed in ADMIN_USER_IDS env var always get 'admin'. */
export async function getUserRole(userId: string): Promise<UserRole> {
  if (HARDCODED_ADMIN_IDS.has(userId)) return "admin";
  const [row] = await db
    .select({ role: userRolesTable.role })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId));
  return (row?.role as UserRole) ?? "player";
}

/** Ensure user has a role row (upsert as player on first visit) */
export async function ensureUserRole(userId: string): Promise<UserRole> {
  await db
    .insert(userRolesTable)
    .values({ userId, role: "player" })
    .onConflictDoNothing();
  return getUserRole(userId);
}

/** Express middleware: requires a valid Clerk session */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/** Express middleware: requires role === 'admin' in user_roles table */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const role = await getUserRole(userId);
    if (role !== "admin") {
      res.status(403).json({ error: "Forbidden – admin only" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Express middleware: requires role === 'admin' or 'owner' */
export async function requireOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const role = await getUserRole(userId);
    if (role !== "admin" && role !== "owner") {
      res.status(403).json({ error: "Forbidden – owner or admin only" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Returns true if the current request's userId matches the court owner (or is admin) */
export async function isOwner(req: Request, ownerUserId: string | null | undefined): Promise<boolean> {
  const { userId } = getAuth(req);
  if (!userId) return false;
  if (ownerUserId && ownerUserId === userId) return true;
  // Admins can act as owners
  const role = await getUserRole(userId);
  return role === "admin";
}

export function getCurrentUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}
