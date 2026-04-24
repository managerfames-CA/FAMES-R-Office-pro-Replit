import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export function useAuth() {
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey()
    }
  });

  return {
    user: error ? null : user,
    isLoading,
    isAdmin: user?.role === "admin",
    isAuthenticated: !!user && !error,
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