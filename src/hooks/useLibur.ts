import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { LiburBody, LiburResponse, NasionalItem } from "../lib/types";

export const useLibur = createResource<LiburResponse>({
  key: "libur",
  path: () => "/api/libur",
  ...POLICY.schedule,
});

const useLiburNasionalResource = createResource<NasionalItem[], number>({
  key: "libur-nasional",
  path: (year) => `/api/libur/nasional?year=${year}`,
  ...POLICY.holiday,
});

export function useLiburNasional(year: number) {
  return useLiburNasionalResource(year);
}

export function useMutateLibur() {
  return useApiMutation(
    (body: LiburBody) => api.post("/api/libur", body),
    () => [["libur"]],
  );
}
