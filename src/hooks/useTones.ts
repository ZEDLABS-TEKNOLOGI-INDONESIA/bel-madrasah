import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useTones(page: number, perPage = 20) {
  return useQuery({
    queryKey: ["tones", page, perPage],
    queryFn: () => api.get(`/api/tones?page=${page}&per_page=${perPage}`),
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
  });
}

export function useUploadTone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.upload("/api/tones/upload", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tones"] }),
  });
}

export function useDeleteTone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => api.post("/api/tones/delete", { filename }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tones"] }),
  });
}

export function usePreviewTone() {
  return useMutation({
    mutationFn: (filename: string) => api.post("/api/tones/preview", { filename }),
  });
}

export function useStopTone() {
  return useMutation({
    mutationFn: () => api.post("/api/tones/stop", {}),
  });
}
