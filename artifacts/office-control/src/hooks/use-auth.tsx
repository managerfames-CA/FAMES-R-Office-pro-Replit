import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useMemo } from "react";

export type PermissionKey =
  | "view_reports"
  | "view_invoices"
  | "manage_invoices"
  | "manage_clients"
  | "view_team_attendance"
  | "view_team_work_logs";

export function useAuth() {
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey(),
    },
  });

  const safeUser = error ? null : user;
  const isAdmin = safeUser?.role === "admin";
  const permissions = useMemo<PermissionKey[]>(() => {
    return ((safeUser?.permissions ?? []) as PermissionKey[]) ?? [];
  }, [safeUser]);

  const can = (perm: PermissionKey) => {
    if (!safeUser) return false;
    if (isAdmin) return true;
    return permissions.includes(perm);
  };

  return {
    user: safeUser,
    isLoading,
    isAdmin,
    isAuthenticated: !!safeUser,
    permissions,
    can,
    mustChangePassword: !!safeUser?.mustChangePassword,
  };
}

export function useLogoutAction() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const logout = useLogout();

  return async () => {
    try {
      await logout.mutateAsync();
    } catch (e) {
      // ignore
    } finally {
      queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
      queryClient.clear();
      setLocation("/login");
    }
  };
}
