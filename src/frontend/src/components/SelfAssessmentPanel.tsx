import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SelfAssessment, TargetedFix } from "@/types";

const BIAS_LABELS: Record<string, string> = {
  confirmationBias: "Confirmation Bias",
  herdMentality: "Herd Mentality",
  statusQuoBias: "Status Quo Bias",
  dispositionEffect: "Disposition Effect",
  fomoRegret: "FOMO/Regret",
  overconfidence: "Overconfidence",
  lossAversion: "Loss Aversion",
  hotHandFallacy: "Hot Hand Fallacy",
};

function ThresholdBar({
  label,
  value,
  threshold,
  hint,
}: {
  label: string;
  value: number;
  threshold: number;
  hint: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const reached = value >= threshold;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs text-foreground">
          {value.toFixed(0)}
          <span className="text-muted-foreground"> / {threshold}</span>
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-1.5 ${reached ? "[&>div]:bg-emerald-500" : "[&>div]:bg-sky-500"}`}
      />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {hint}
      </p>
    </div>
  );
}

export function SelfAssessmentPanel({
  assessment,
  targetedFixes,
}: {
  assessment: SelfAssessment;
  targetedFixes: TargetedFix[];
}) {
  const p20 = Number(assessment.progressTo20);
  const p50 = Number(assessment.progressTo50);
  const topBiases = assessment.topBiases ?? [];

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-tight">
          Self-Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ThresholdBar
            label="Progress to 20 trades"
            value={p20}
            threshold={20}
            hint="Baseline sample"
          />
          <ThresholdBar
            label="Progress to 50 trades"
            value={p50}
            threshold={50}
            hint="Statistical significance"
          />
        </div>

        {topBiases.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Top biases
            </span>
            <div className="flex flex-wrap gap-1.5">
              {topBiases.map((b) => (
                <Badge
                  key={b}
                  variant="outline"
                  className="font-mono text-[10px] uppercase bg-muted/40"
                >
                  {BIAS_LABELS[b] ?? b}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {targetedFixes.length > 0 && (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Targeted fixes
            </span>
            <ul className="space-y-2">
              {targetedFixes.map((fix) => (
                <li key={fix.type} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">
                      {BIAS_LABELS[fix.type] ?? fix.type}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {fix.suggestion}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
