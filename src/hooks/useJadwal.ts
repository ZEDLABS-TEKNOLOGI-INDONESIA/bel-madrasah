import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useJadwal(mode: string) {
  return useQuery({
    queryKey: ["jadwal", mode],
    queryFn: () => api.get(`/api/jadwal?mode=${mode}`),
    staleTime: 60_000,
  });
}

export function useJadwalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/api/jadwal/entry", body),
    onSuccess: (_data, variables: any) => {
      qc.invalidateQueries({ queryKey: ["jadwal", variables.mode] });
    },
  });
}

export function useDayToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mode: string; hari: string; disable: boolean }) =>
      api.post("/api/jadwal/day-toggle", body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["jadwal", variables.mode] });
    },
  });
}
