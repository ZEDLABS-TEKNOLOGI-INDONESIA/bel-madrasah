import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { EqualizerResponse, EqualizerSettings } from "../lib/types";

export const useEqualizer = createResource<EqualizerResponse>({
  key: "equalizer",
  path: () => "/api/equalizer",
  ...POLICY.schedule,
});

export function useSaveEqualizer() {
  return useApiMutation(
    (body: EqualizerSettings) => api.post("/api/equalizer", body),
    () => [["equalizer"]],
  );
}
