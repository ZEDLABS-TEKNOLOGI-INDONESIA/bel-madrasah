import { api } from "../lib/api";
import { POLICY, createResource, useApiMutation } from "../lib/createResource";
import type {
  DeleteToneResponse,
  RenameToneBody,
  RenameToneResponse,
  TonesQuery,
  TonesResponse,
} from "../lib/types";

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
    (filename: string) => api.post<DeleteToneResponse>("/api/tones/delete", { filename }),
    () => [["tones"], ["jadwal"], ["service-status"]],
  );
}

export function useRenameTone() {
  return useApiMutation(
    (body: RenameToneBody) => api.post<RenameToneResponse>("/api/tones/rename", body),
    () => [["tones"], ["jadwal"], ["service-status"]],
  );
}
