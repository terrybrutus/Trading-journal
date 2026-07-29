import { createActor } from "@/backend";
import type {
  ListResult,
  SkippedTrade,
  Trade,
  TradeListFilter,
  TradeSort,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a yyyy-MM-dd string to nanoseconds since epoch, or undefined. */
export function dateToNs(date?: string): bigint | undefined {
  if (!date) return undefined;
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return undefined;
  return BigInt(ms) * 1_000_000n;
}

/** Build a backend `TradeListFilter` from the URL-persisted journal search. */
export function toTradeListFilter(input: {
  q?: string;
  origin?: string;
  emotion?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: TradeSort;
}): TradeListFilter {
  const trimmed = input.q?.trim();
  return {
    sortBy: (input.sort ?? "dateDesc") as TradeSort,
    symbolQuery: trimmed ? trimmed : undefined,
    originTag: input.origin as TradeListFilter["originTag"] | undefined,
    emotionalState: input.emotion as
      | TradeListFilter["emotionalState"]
      | undefined,
    dateFromNs: dateToNs(input.dateFrom),
    dateToNs: dateToNs(input.dateTo),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useListTrades(
  filter: TradeListFilter,
  limit: bigint,
  offset: bigint,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["trades", filter, limit.toString(), offset.toString()],
    queryFn: async (): Promise<ListResult<Trade>> => {
      if (!actor) return { total: 0n, items: [] };
      return actor.listTrades(filter, limit, offset);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTrade(tradeId: bigint | undefined) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["trade", tradeId?.toString() ?? "none"],
    queryFn: async (): Promise<Trade | null> => {
      if (!actor || tradeId === undefined) return null;
      return actor.getTrade(tradeId);
    },
    enabled: !!actor && !isFetching && tradeId !== undefined,
  });
}

export function useListSkippedTrades(limit: bigint, offset: bigint) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["skippedTrades", limit.toString(), offset.toString()],
    queryFn: async (): Promise<ListResult<SkippedTrade>> => {
      if (!actor) return { total: 0n, items: [] };
      return actor.listSkippedTrades(limit, offset);
    },
    enabled: !!actor && !isFetching,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (
      input: Parameters<NonNullable<typeof actor>["createTrade"]>[0],
    ): Promise<bigint> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.createTrade(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["skippedTrades"] });
    },
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (args: {
      tradeId: bigint;
      updates: Parameters<NonNullable<typeof actor>["updateTrade"]>[1];
    }): Promise<Trade> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.updateTrade(args.tradeId, args.updates);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.setQueryData(["trade", updated.id.toString()], updated);
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (tradeId: bigint): Promise<boolean> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.deleteTrade(tradeId);
    },
    onSuccess: (_, tradeId) => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.removeQueries({ queryKey: ["trade", tradeId.toString()] });
    },
  });
}

export function useCreateSkippedTrade() {
  const queryClient = useQueryClient();
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (
      input: Parameters<NonNullable<typeof actor>["addSkippedTrade"]>[0],
    ): Promise<SkippedTrade> => {
      if (!actor) throw new Error("Backend actor not ready");
      return actor.addSkippedTrade(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skippedTrades"] });
    },
  });
}
