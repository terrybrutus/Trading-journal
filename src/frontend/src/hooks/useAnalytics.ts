import { createActor } from "@/backend";
import type {
  BiasSignature,
  BiasSignatureType,
  ConfidenceOutcomeAnalysis,
  DailyTradeSummary,
  HoldTimeAnalysis,
  SelfAssessment,
  StrategyBaselineAnalysis,
  TargetedFix,
} from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Self-assessment (the bias dashboard's headline view)
// ---------------------------------------------------------------------------

export function useSelfAssessment() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["selfAssessment"],
    queryFn: async (): Promise<SelfAssessment | null> => {
      if (!actor) return null;
      return actor.getSelfAssessment();
    },
    enabled: !!actor && !isFetching,
  });
}

// ---------------------------------------------------------------------------
// Weekly bias signatures
// ---------------------------------------------------------------------------

export function useWeeklySignatures(weekStartNs: bigint, weekEndNs: bigint) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: [
      "weeklySignatures",
      weekStartNs.toString(),
      weekEndNs.toString(),
    ],
    queryFn: async (): Promise<BiasSignature[]> => {
      if (!actor) return [];
      return actor.getWeeklySignatures(weekStartNs, weekEndNs);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useTargetedFixes(biasTypes: BiasSignatureType[]) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["targetedFixes", biasTypes.join(",")],
    queryFn: async (): Promise<TargetedFix[]> => {
      if (!actor) return [];
      return actor.getTargetedFixes(biasTypes);
    },
    enabled: !!actor && !isFetching && biasTypes.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Monthly analyses
// ---------------------------------------------------------------------------

export function useMonthlyConfidenceOutcome(
  monthStartNs: bigint,
  monthEndNs: bigint,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: [
      "monthlyConfidenceOutcome",
      monthStartNs.toString(),
      monthEndNs.toString(),
    ],
    queryFn: async (): Promise<ConfidenceOutcomeAnalysis | null> => {
      if (!actor) return null;
      return actor.getMonthlyConfidenceOutcome(monthStartNs, monthEndNs);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useMonthlyHoldTimeAnalysis(
  monthStartNs: bigint,
  monthEndNs: bigint,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: [
      "monthlyHoldTime",
      monthStartNs.toString(),
      monthEndNs.toString(),
    ],
    queryFn: async (): Promise<HoldTimeAnalysis | null> => {
      if (!actor) return null;
      return actor.getMonthlyHoldTimeAnalysis(monthStartNs, monthEndNs);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useMonthlyStrategyBaseline(
  monthStartNs: bigint,
  monthEndNs: bigint,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: [
      "monthlyStrategyBaseline",
      monthStartNs.toString(),
      monthEndNs.toString(),
    ],
    queryFn: async (): Promise<StrategyBaselineAnalysis | null> => {
      if (!actor) return null;
      return actor.getMonthlyStrategyBaseline(monthStartNs, monthEndNs);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useMonthlyFomoAnalysis(
  monthStartNs: bigint,
  monthEndNs: bigint,
) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["monthlyFomo", monthStartNs.toString(), monthEndNs.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMonthlyFomoAnalysis(monthStartNs, monthEndNs);
    },
    enabled: !!actor && !isFetching,
  });
}

// ---------------------------------------------------------------------------
// Daily summary
// ---------------------------------------------------------------------------

export function useDailySummary(dayStartNs: bigint) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["dailySummary", dayStartNs.toString()],
    queryFn: async (): Promise<DailyTradeSummary[]> => {
      if (!actor) return [];
      return actor.getDailySummary(dayStartNs);
    },
    enabled: !!actor && !isFetching,
  });
}
