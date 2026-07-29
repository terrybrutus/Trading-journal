import { TradeForm, type TradeFormValues } from "@/components/TradeForm";
import { useCreateTrade } from "@/hooks";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function NewTrade() {
  const navigate = useNavigate();
  const createTrade = useCreateTrade();

  async function onSubmit(values: TradeFormValues) {
    try {
      const now = BigInt(Date.now()) * 1_000_000n;
      const created = await createTrade.mutateAsync({
        symbol: values.symbol,
        direction: values.direction,
        tradeOrigin: values.origin,
        entryPrice: Number(values.entryPrice),
        exitPrice: values.exitPrice ? Number(values.exitPrice) : undefined,
        positionSize: Number(values.size),
        confidenceRating: BigInt(values.confidence),
        preTradeThesis: {
          thesis: values.thesis,
          counterReasons: [
            values.counterReason1,
            values.counterReason2,
            values.counterReason3,
          ]
            .filter((r) => r && r.trim().length > 0)
            .map((text) => ({ text })),
        },
        preSessionEmotion: {
          state: values.emotion,
          note: "",
          capturedAtNs: now,
        },
        realizedPnl: values.outcome ? Number(values.outcome) : undefined,
        outcomeReasoning: values.notes || undefined,
        entryAtNs: now,
        isDraft: false,
      });
      toast.success("Trade saved", { description: `${values.symbol}` });
      navigate({
        to: "/trades/$tradeId",
        params: { tradeId: created.toString() },
      });
    } catch (_e) {
      toast.error("Failed to save trade", { description: "Please retry." });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          New Trade
        </h1>
        <p className="text-sm text-muted-foreground">
          Capture the thesis, confidence, and counter-thesis before entry.
        </p>
      </div>
      <TradeForm onSubmit={onSubmit} submitting={createTrade.isPending} />
    </div>
  );
}
