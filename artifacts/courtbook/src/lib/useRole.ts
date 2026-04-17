import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
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

  const query = useQuery<RoleResponse>({
    queryKey: ["me-role"],
    queryFn: () => customFetch<RoleResponse>("/api/me/role", { method: "GET" }),
    enabled: isLoaded && !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const role = query.data?.role ?? null;
  const status = query.data?.status ?? "active";

  return {
    role,
    status,
    pendingRole: query.data?.pendingRole ?? null,
    rejectionReason: query.data?.rejectionReason ?? null,
    isLoading: !isLoaded || (!!isSignedIn && query.isLoading),
    isAdmin: role === "admin",
    isOwner: role === "owner" || role === "admin",
    isCoach: role === "coach",
    isPlayer: role === "player",
    isPending: status === "pending_approval",
    isRejected: status === "rejected",
  };
}
