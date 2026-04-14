import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type UserRole = "admin" | "owner" | "player";

interface RoleResponse {
  userId: string;
  role: UserRole;
}

/**
 * Fetches the current user's role from the DB.
 * Returns null while loading or when signed out.
 */
export function useRole() {
  const { isSignedIn, isLoaded } = useAuth();

  const query = useQuery<RoleResponse>({
    queryKey: ["me-role"],
    queryFn: () => customFetch<RoleResponse>("/api/me/role", { method: "GET" }),
    enabled: isLoaded && !!isSignedIn,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    role: query.data?.role ?? null,
    isLoading: !isLoaded || (!!isSignedIn && query.isLoading),
    isAdmin: query.data?.role === "admin",
    isOwner: query.data?.role === "owner" || query.data?.role === "admin",
    isPlayer: query.data?.role === "player",
  };
}
