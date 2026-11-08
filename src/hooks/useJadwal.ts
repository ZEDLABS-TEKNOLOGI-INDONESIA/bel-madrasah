import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { DayToggleBody, JadwalEntryBody, JadwalResponse } from "../lib/types";

const useJadwalResource = createResource<JadwalResponse, string>({
  key: "jadwal",
  path: (mode) => `/api/jadwal?mode=${mode}`,
  ...POLICY.schedule,
});

export function useJadwal(mode: string, enabled = true) {
  return useJadwalResource(mode, { enabled });
}

export function useJadwalEntry() {
  return useApiMutation(
    (body: JadwalEntryBody) => api.post("/api/jadwal/entry", body),
    (body) => [["jadwal", body.mode]],
  );
}

export function useDayToggle() {
  return useApiMutation(
    (body: DayToggleBody) => api.post("/api/jadwal/day-toggle", body),
    (body) => [["jadwal", body.mode]],
  );
}

export function useResetJadwal() {
  return useApiMutation(
    (mode: string) => api.post("/api/jadwal/reset", { mode }),
    () => [["jadwal"]],
  );
}
