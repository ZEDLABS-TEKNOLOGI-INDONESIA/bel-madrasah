import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useLibur() {
  return useQuery({
    queryKey: ["libur"],
    queryFn: () => api.get("/api/libur"),
    staleTime: 60_000,
  });
}

export function useLiburNasional(year: number) {
  return useQuery({
    queryKey: ["libur-nasional", year],
    queryFn: () => api.get(`/api/libur/nasional?year=${year}`),
    staleTime: 24 * 60 * 60_000,
  });
}

export function useMutateLibur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: "add" | "delete"; date: string; keterangan: string }) =>
      api.post("/api/libur", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libur"] }),
  });
}
