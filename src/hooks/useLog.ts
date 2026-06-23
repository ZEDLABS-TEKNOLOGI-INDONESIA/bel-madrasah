import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useLog() {
  return useQuery({
    queryKey: ["log"],
    queryFn: () => api.get("/api/log"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useResetLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/log/reset", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log"] }),
  });
}
