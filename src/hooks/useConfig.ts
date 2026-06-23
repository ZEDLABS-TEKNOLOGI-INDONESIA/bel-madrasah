import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api.get("/api/config"),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/api/config", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config"] }),
  });
}

export function useServiceStatus() {
  return useQuery({
    queryKey: ["service-status"],
    queryFn: () => api.get("/api/service/status"),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useServiceToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/service/toggle", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-status"] });
      qc.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

export function useVolume() {
  return useQuery({
    queryKey: ["volume"],
    queryFn: () => api.get("/api/volume"),
    staleTime: 60_000,
  });
}

export function useUpdateVolume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (volume: number) => api.post("/api/volume", { volume }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["volume"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["service-status"] });
    },
  });
}
