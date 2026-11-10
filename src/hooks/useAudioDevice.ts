import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { AudioDevicesResponse } from "../lib/types";

export const useAudioDevices = createResource<AudioDevicesResponse>({
  key: "audio-devices",
  path: () => "/api/audio/devices",
  ...POLICY.config,
});

export function useSaveAudioDevice() {
  return useApiMutation(
    (device: string) => api.post("/api/audio/devices", { device }),
    () => [["audio-devices"]],
  );
}

export function useTestSpeaker() {
  return useApiMutation(
    (device: string) => api.post("/api/audio/test", { device }),
    () => [["service-status"]],
  );
}
