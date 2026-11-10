import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const POLICY = {
  status: { staleTime: 4_000, refetchInterval: 5_000 },
  config: { staleTime: 30_000, refetchInterval: 15_000 },
  log: { staleTime: 30_000, refetchInterval: 30_000 },
  schedule: { staleTime: 60_000, refetchInterval: false },
  holiday: { staleTime: 24 * 60 * 60_000, refetchInterval: false, retry: 0 },
} as const;

interface ResourceConfig<K> {
  key: string;
  path: (param: K) => string;
  staleTime: number;
  refetchInterval?: number | false;
  retry?: number;
}

interface ResourceOptions {
  enabled?: boolean;
  keepPrevious?: boolean;
}

type KeyList = readonly (readonly unknown[])[];

export function createResource<T, K = undefined>(config: ResourceConfig<K>) {
  return function useResource(param?: K, options?: ResourceOptions) {
    return useQuery<T>({
      queryKey: param === undefined ? [config.key] : [config.key, param],
      queryFn: () => api.get<T>(config.path(param as K)),
      staleTime: config.staleTime,
      refetchInterval: config.refetchInterval ?? false,
      ...(config.retry !== undefined && { retry: config.retry }),
      enabled: options?.enabled ?? true,
      placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
    });
  };
}

export function useApiMutation<TInput, TOutput = unknown>(
  run: (input: TInput) => Promise<TOutput>,
  keys: (input: TInput) => KeyList,
) {
  const queryClient = useQueryClient();
  return useMutation<TOutput, Error, TInput>({
    mutationFn: run,
    onSuccess: (_data, input) =>
      Promise.all(
        keys(input).map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
      ),
  });
}
