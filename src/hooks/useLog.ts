import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { LogResponse } from "../lib/types";

export const useLog = createResource<LogResponse>({
  key: "log",
  path: () => "/api/log",
  ...POLICY.log,
});

export function useResetLog() {
  return useApiMutation(
    () => api.post("/api/log/reset", {}),
    () => [["log"]],
  );
}
