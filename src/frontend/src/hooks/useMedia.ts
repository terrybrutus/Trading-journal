import { createActor } from "@/backend";
import type { AudioRecap, Media } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useListMediaForTrade(tradeId: bigint | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["media", tradeId?.toString() ?? "none"],
    queryFn: async (): Promise<Media[]> => {
      if (!actor || tradeId === undefined) return [];
      return actor.listMediaForTrade(tradeId);
    },
    enabled: !!actor && !isFetching && tradeId !== undefined,
  });
}

export function useListAudioRecapsForTrade(tradeId: bigint | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["audioRecaps", tradeId?.toString() ?? "none"],
    queryFn: async (): Promise<AudioRecap[]> => {
      if (!actor || tradeId === undefined) return [];
      return actor.listAudioRecapsForTrade(tradeId);
    },
    enabled: !!actor && !isFetching && tradeId !== undefined,
  });
}

export function useAddMediaToTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (args: {
      tradeId: bigint;
      media: Parameters<NonNullable<typeof actor>["addMediaToTrade"]>[1];
    }): Promise<Media> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.addMediaToTrade(args.tradeId, args.media);
    },
    onSuccess: (_, args) => {
      queryClient.invalidateQueries({
        queryKey: ["media", args.tradeId.toString()],
      });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (args: {
      tradeId: bigint;
      mediaId: bigint;
    }): Promise<boolean> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.deleteMedia(args.tradeId, args.mediaId);
    },
    onSuccess: (_, args) => {
      queryClient.invalidateQueries({
        queryKey: ["media", args.tradeId.toString()],
      });
    },
  });
}

export function useAddAudioRecapToTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (args: {
      tradeId: bigint;
      recap: Parameters<NonNullable<typeof actor>["addAudioRecapToTrade"]>[1];
    }): Promise<AudioRecap> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.addAudioRecapToTrade(args.tradeId, args.recap);
    },
    onSuccess: (_, args) => {
      queryClient.invalidateQueries({
        queryKey: ["audioRecaps", args.tradeId.toString()],
      });
    },
  });
}
