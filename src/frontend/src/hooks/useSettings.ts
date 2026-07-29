import { createActor } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useHasApiToken() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["hasApiToken"],
    queryFn: async (): Promise<boolean> => {
      if (!actor) return false;
      return actor.hasApiToken();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGenerateApiToken() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.generateApiToken();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hasApiToken"] });
    },
  });
}

export function useRegenerateApiToken() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.regenerateApiToken();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hasApiToken"] });
    },
  });
}
