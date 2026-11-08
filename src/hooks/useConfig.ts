import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { Config, ConfigResponse, ServiceStatus, VolumeResponse } from "../lib/types";

export const useConfig = createResource<ConfigResponse>({
  key: "config",
  path: () => "/api/config",
  ...POLICY.config,
});

export const useServiceStatus = createResource<ServiceStatus>({
  key: "service-status",
  path: () => "/api/service/status",
  ...POLICY.status,
});

export const useVolume = createResource<VolumeResponse>({
  key: "volume",
  path: () => "/api/volume",
  ...POLICY.schedule,
});

export function useUpdateConfig() {
  return useApiMutation(
    (body: Config) => api.post("/api/config", body),
    () => [["config"]],
  );
}

export function useServiceToggle() {
  return useApiMutation(
    () => api.post("/api/service/toggle", {}),
    () => [["service-status"], ["config"]],
  );
}

export function useUpdateVolume() {
  return useApiMutation(
    (volume: number) => api.post("/api/volume", { volume }),
    () => [["volume"], ["config"], ["service-status"]],
  );
}
