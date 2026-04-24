import { useGetFirmProfile, getGetFirmProfileQueryKey } from "@workspace/api-client-react";

export const DEFAULT_FIRM_NAME = "FAMES & R Workspace";
export const DEFAULT_FIRM_TAGLINE = "Manage • Collaborate • Grow";

export function useFirmBranding(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled !== false;
  const { data, isLoading } = useGetFirmProfile({
    query: {
      queryKey: getGetFirmProfileQueryKey(),
      enabled,
      retry: false,
      staleTime: 60_000,
    },
  });

  const name = data?.name?.trim() || DEFAULT_FIRM_NAME;
  const tagline = data?.tagline?.trim() || DEFAULT_FIRM_TAGLINE;
  const logoUrl = data?.logoUrl?.trim() || null;
  const address = data?.address?.trim() || null;
  const phone = data?.phone?.trim() || null;
  const email = data?.email?.trim() || null;

  const isCustomized = Boolean(
    data?.name?.trim() || data?.logoUrl?.trim() || data?.tagline?.trim(),
  );

  return {
    name,
    tagline,
    logoUrl,
    address,
    phone,
    email,
    isCustomized,
    isLoading,
    raw: data ?? null,
  };
}
