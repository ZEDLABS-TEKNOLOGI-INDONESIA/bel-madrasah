import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type { TonesQuery, TonesResponse } from "../lib/types";

const useTonesResource = createResource<TonesResponse, TonesQuery>({
  key: "tones",
  path: ({ page, perPage }) => `/api/tones?page=${page}&per_page=${perPage}`,
  ...POLICY.schedule,
});

export function useTones(page: number, perPage = 20) {
  return useTonesResource({ page, perPage }, { keepPrevious: true });
}

export function useUploadTone() {
  return useApiMutation(
    (form: FormData) => api.upload("/api/tones/upload", form),
    () => [["tones"]],
  );
}

export function useDeleteTone() {
  return useApiMutation(
    (filename: string) => api.post("/api/tones/delete", { filename }),
    () => [["tones"]],
  );
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
