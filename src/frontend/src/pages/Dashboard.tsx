import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dateToNs,
  useDailySummary,
  useListTrades,
  useSelfAssessment,
} from "@/hooks";
import type { DailyTradeSummary } from "@/types";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

function startOfDayNs(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return dateToNs(start.toISOString());
}

function pnlTone(v: number) {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

export function Dashboard() {
  const dayStartNs = useMemo(() => startOfDayNs(), []);
  const tradesQuery = useListTrades({ sortBy: "dateDesc" } as any, 5n, 0n);
  const dailyQuery = useDailySummary(dayStartNs ?? 0n);
  const assessmentQuery = useSelfAssessment();

  const trades = tradesQuery.data?.items ?? [];
  const daily = (dailyQuery.data ?? []) as DailyTradeSummary[];

  const dailyStats = useMemo(() => {
    const count = daily.length;
    const pnl = daily.reduce((s, d) => s + Number(d.realizedPnl ?? 0), 0);
    const wins = daily.filter((d) => Number(d.realizedPnl ?? 0) > 0).length;
    const winRate = count > 0 ? (wins / count) * 100 : 0;
    return { count, pnl, winRate };
  }, [daily]);

  const assessment = assessmentQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Today&apos;s activity and recent trades.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trades today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {dailyStats.count}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Daily PnL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`font-mono text-3xl font-semibold tabular-nums ${pnlTone(dailyStats.pnl)}`}
            >
              {dailyStats.pnl >= 0 ? "+" : ""}
              {dailyStats.pnl.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Win rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {dailyStats.winRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium tracking-tight">
              Recent trades
            </CardTitle>
            <Link
              to="/trades/new"
              className="text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              + New trade
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No trades yet.{" "}
              <Link
                to="/trades/new"
                className="ml-1 text-sky-400 hover:text-sky-300"
              >
                Add your first trade.
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {trades.map((t) => {
                const pnl = Number(t.realizedPnl ?? 0);
                return (
                  <Link
                    key={t.id}
                    to="/trades/$tradeId"
                    params={{ tradeId: t.id.toString() }}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] uppercase ${
                          t.direction === "long"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {t.direction}
                      </Badge>
                      <div>
                        <p className="font-mono text-sm font-medium">
                          {t.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          conf {Number(t.confidenceRating ?? 0)} ·{" "}
                          {t.tradeOrigin}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold tabular-nums ${pnlTone(pnl)}`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {assessment && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Self-assessment snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Progress to 20</p>
                <p className="font-mono text-lg font-semibold">
                  {Number(assessment.progressTo20).toFixed(0)}
                  <span className="text-muted-foreground"> / 20</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress to 50</p>
                <p className="font-mono text-lg font-semibold">
                  {Number(assessment.progressTo50).toFixed(0)}
                  <span className="text-muted-foreground"> / 50</span>
                </p>
              </div>
            </div>
            {assessment.topBiases && assessment.topBiases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assessment.topBiases.map((b) => (
                  <Badge
                    key={b}
                    variant="outline"
                    className="font-mono text-[10px] uppercase bg-muted/40"
                  >
                    {b}
                  </Badge>
                ))}
              </div>
            )}
            <Link
              to="/analytics"
              className="inline-block text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              View full analytics →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
