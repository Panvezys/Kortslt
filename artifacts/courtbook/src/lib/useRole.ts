import { useAuth, useSession, useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";

export type UserRole = "admin" | "owner" | "coach" | "player";
export type RoleStatus = "active" | "pending_approval" | "rejected";

interface RoleResponse {
  userId: string;
  role: UserRole;
  status: RoleStatus;
  pendingRole: UserRole | null;
  rejectionReason: string | null;
}

export function useRole() {
  const { isSignedIn, isLoaded } = useAuth();
  const { session } = useSession();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined)
    ?.split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const query = useQuery<RoleResponse>({
    queryKey: ["me-role"],
    queryFn: () => customFetch<RoleResponse>("/api/me/role", { method: "GET" }),
    enabled: isLoaded && !!isSignedIn,
    // Short stale time so role changes propagate quickly without spamming the API.
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });

  /** Force a full refresh: re-touch Clerk session, reload Clerk user (picks up
   *  any metadata changes server-side), and re-fetch the backend role. */
  const refresh = useCallback(async () => {
    try { await session?.touch(); } catch { /* best-effort */ }
    try { await user?.reload(); } catch { /* best-effort */ }
    await queryClient.invalidateQueries({ queryKey: ["me-role"] });
  }, [session, user, queryClient]);

  const role = query.data?.role ?? null;
  const status = query.data?.status ?? "active";
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  const forcedAdmin = adminEmails.includes(email);

  return {
    role: forcedAdmin ? "admin" : role,
    status,
    pendingRole: query.data?.pendingRole ?? null,
    rejectionReason: query.data?.rejectionReason ?? null,
    isLoading: !isLoaded || (!!isSignedIn && query.isLoading),
    isAdmin: forcedAdmin || role === "admin",
    isOwner: forcedAdmin || role === "owner" || role === "admin",
    isCoach: role === "coach",
    isPlayer: role === "player",
    isPending: status === "pending_approval",
    isRejected: status === "rejected",
    refresh,
    isFetching: query.isFetching,
  };
}
