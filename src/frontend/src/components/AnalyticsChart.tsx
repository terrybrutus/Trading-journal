import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export interface AnalyticsChartProps {
  confidenceVsPnl?: Array<{ confidence: number; pnl: number; symbol?: string }>;
  winRateByBias?: Array<{ bias: string; winRate: number; trades: number }>;
  title?: string;
}

const AXIS = {
  stroke: "rgb(148 163 184 / 0.4)",
  fontSize: 11,
  fontFamily: "JetBrains Mono",
};
const GRID = "rgb(148 163 184 / 0.12)";

function pnlColor(v: number) {
  if (v > 0) return "rgb(52 211 153)";
  if (v < 0) return "rgb(248 113 113)";
  return "rgb(148 163 184)";
}

export function AnalyticsChart({
  confidenceVsPnl = [],
  winRateByBias = [],
  title,
}: AnalyticsChartProps) {
  const hasScatter = confidenceVsPnl.length > 0;
  const hasBars = winRateByBias.length > 0;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium tracking-tight">
          {title ?? "Analytics"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasScatter && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 10, right: 16, bottom: 24, left: 8 }}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="confidence"
                  name="Confidence"
                  domain={[0, 100]}
                  tick={AXIS}
                  tickFormatter={(v) => `${v}`}
                  label={{
                    value: "Confidence",
                    position: "insideBottom",
                    offset: -10,
                    fill: "rgb(148 163 184)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="pnl"
                  name="PnL"
                  tick={AXIS}
                  tickFormatter={(v) => `${v}`}
                />
                <ZAxis range={[60, 60]} />
                <ReferenceLine y={0} stroke="rgb(148 163 184 / 0.5)" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "rgb(15 23 42)",
                    border: "1px solid rgb(51 65 85)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "JetBrains Mono",
                  }}
                  formatter={(value: number, name: string) => [
                    name === "PnL" ? value.toFixed(2) : value,
                    name,
                  ]}
                />
                <Scatter data={confidenceVsPnl}>
                  {confidenceVsPnl.map((d, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: scatter points have no stable id
                    <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {hasBars && (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={winRateByBias}
                margin={{ top: 10, right: 16, bottom: 24, left: 8 }}
              >
                <CartesianGrid
                  stroke={GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="bias"
                  tick={AXIS}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  type="number"
                  domain={[0, 100]}
                  tick={AXIS}
                  tickFormatter={(v) => `${v}%`}
                />
                <ReferenceLine
                  y={50}
                  stroke="rgb(148 163 184 / 0.5)"
                  strokeDasharray="4 4"
                />
                <Tooltip
                  cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
                  contentStyle={{
                    background: "rgb(15 23 42)",
                    border: "1px solid rgb(51 65 85)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "JetBrains Mono",
                  }}
                  formatter={(value: number) => [
                    `${value.toFixed(1)}%`,
                    "Win rate",
                  ]}
                />
                <Bar dataKey="winRate" radius={[3, 3, 0, 0]}>
                  {winRateByBias.map((d, i) => (
                    <Cell
                      // biome-ignore lint/suspicious/noArrayIndexKey: bar cells have no stable id
                      key={i}
                      fill={
                        d.winRate >= 50 ? "rgb(52 211 153)" : "rgb(248 113 113)"
                      }
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!hasScatter && !hasBars && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No analytics data yet for this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
