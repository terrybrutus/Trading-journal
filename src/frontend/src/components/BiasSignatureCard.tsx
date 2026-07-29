import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BiasSignature } from "@/types";

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

const BIAS_TONES: Record<string, string> = {
  confirmationBias: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  herdMentality: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  statusQuoBias: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  dispositionEffect: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  fomoRegret: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  overconfidence: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  lossAversion: "bg-red-500/15 text-red-300 border-red-500/30",
  hotHandFallacy: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

export function BiasSignatureCard({ signature }: { signature: BiasSignature }) {
  const label = BIAS_LABELS[signature.type] ?? signature.type;
  const tone =
    BIAS_TONES[signature.type] ??
    "bg-muted text-muted-foreground border-border";
  const tradeCount = signature.tradeIds.length;

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium tracking-tight">
            {label}
          </CardTitle>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase ${tone}`}
          >
            {signature.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {signature.description}
        </p>
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Trades flagged
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {tradeCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
