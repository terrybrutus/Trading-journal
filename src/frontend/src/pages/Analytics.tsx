import { BiasSignatureCard } from "@/components/BiasSignatureCard";
import { SelfAssessmentPanel } from "@/components/SelfAssessmentPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dateToNs,
  useMonthlyConfidenceOutcome,
  useMonthlyFomoAnalysis,
  useMonthlyHoldTimeAnalysis,
  useMonthlyStrategyBaseline,
  useSelfAssessment,
  useTargetedFixes,
  useWeeklySignatures,
} from "@/hooks";
import type { BiasSignatureType } from "@/types";
import { useMemo, useState } from "react";

type Range = "weekly" | "monthly";

function weekBounds(d = new Date()) {
  const end = new Date(d);
  const start = new Date(d);
  start.setDate(start.getDate() - 7);
  return { start, end };
}

function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function Analytics() {
  const [range, setRange] = useState<Range>("weekly");

  const week = useMemo(() => weekBounds(), []);
  const month = useMemo(() => monthBounds(), []);

  const weekStartNs = dateToNs(week.start.toISOString());
  const weekEndNs = dateToNs(week.end.toISOString());
  const monthStartNs = dateToNs(month.start.toISOString());
  const monthEndNs = dateToNs(month.end.toISOString());

  const weeklySignatures = useWeeklySignatures(
    weekStartNs ?? 0n,
    weekEndNs ?? 0n,
  );
  const holdTime = useMonthlyHoldTimeAnalysis(
    monthStartNs ?? 0n,
    monthEndNs ?? 0n,
  );
  const confidenceOutcome = useMonthlyConfidenceOutcome(
    monthStartNs ?? 0n,
    monthEndNs ?? 0n,
  );
  const fomo = useMonthlyFomoAnalysis(monthStartNs ?? 0n, monthEndNs ?? 0n);
  const baseline = useMonthlyStrategyBaseline(
    monthStartNs ?? 0n,
    monthEndNs ?? 0n,
  );
  const assessment = useSelfAssessment();

  const signatures = weeklySignatures.data ?? [];
  const targetedBiasTypes = Array.from(
    new Set(signatures.map((s) => s.type as BiasSignatureType)),
  );
  const targetedFixes = useTargetedFixes(targetedBiasTypes);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Bias signatures, confidence outcomes, and self-assessment.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
          {(["weekly", "monthly"] as Range[]).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={range === r ? "default" : "ghost"}
              onClick={() => setRange(r)}
              className="font-mono text-xs uppercase"
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Bias signatures{" "}
          {range === "weekly" ? "(last 7 days)" : "(this month)"}
        </h2>
        {signatures.length === 0 ? (
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No bias signatures detected for this period.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signatures.map((s) => (
              <BiasSignatureCard key={s.type} signature={s} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Confidence vs outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            {!confidenceOutcome.data ? (
              <p className="text-muted-foreground">No data for this month.</p>
            ) : (
              <>
                <StatRow
                  label="Confidence / PnL correlation"
                  value={confidenceOutcome.data.correlation.toFixed(3)}
                />
                <StatRow
                  label="Overconfidence flag"
                  value={
                    confidenceOutcome.data.overconfidenceFlag ? "yes" : "no"
                  }
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Strategy baseline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            {!baseline.data ? (
              <p className="text-muted-foreground">No data for this month.</p>
            ) : (
              <>
                <StatRow
                  label="Win rate"
                  value={`${(baseline.data.winRate * 100).toFixed(1)}%`}
                />
                <StatRow
                  label="Profit factor"
                  value={baseline.data.profitFactor.toFixed(2)}
                />
                {baseline.data.historicalWinRate !== undefined && (
                  <StatRow
                    label="Historical win rate"
                    value={`${(baseline.data.historicalWinRate * 100).toFixed(1)}%`}
                  />
                )}
                {baseline.data.historicalProfitFactor !== undefined && (
                  <StatRow
                    label="Historical profit factor"
                    value={baseline.data.historicalProfitFactor.toFixed(2)}
                  />
                )}
                <StatRow
                  label="Status-quo bias flag"
                  value={baseline.data.statusQuoBiasFlag ? "yes" : "no"}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Hold-time analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            {!holdTime.data ? (
              <p className="text-muted-foreground">No data for this month.</p>
            ) : (
              <>
                <StatRow
                  label="Avg winner hold"
                  value={
                    holdTime.data.avgWinnerHoldSecs !== undefined
                      ? `${Number(holdTime.data.avgWinnerHoldSecs).toFixed(0)}s`
                      : "—"
                  }
                />
                <StatRow
                  label="Avg loser hold"
                  value={
                    holdTime.data.avgLoserHoldSecs !== undefined
                      ? `${Number(holdTime.data.avgLoserHoldSecs).toFixed(0)}s`
                      : "—"
                  }
                />
                <StatRow
                  label="Loss-aversion flag"
                  value={holdTime.data.lossAversionFlag ? "yes" : "no"}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              FOMO analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            {!fomo.data ? (
              <p className="text-muted-foreground">
                No FOMO events this month.
              </p>
            ) : (
              <>
                <StatRow
                  label="FOMO-tagged trades"
                  value={`${fomo.data.fomoTaggedTradeIds.length}`}
                />
                <StatRow
                  label="Skipped trades"
                  value={`${fomo.data.skippedTrades.length}`}
                />
                <StatRow
                  label="Theoretical PnL total"
                  value={fomo.data.theoreticalPnlTotal.toFixed(2)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {assessment.data && (
        <SelfAssessmentPanel
          assessment={assessment.data}
          targetedFixes={targetedFixes.data ?? []}
        />
      )}
    </div>
  );
}
