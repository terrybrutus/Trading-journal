import { AiFieldConfirm } from "@/components/AiFieldConfirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUniversalMicContext } from "@/hooks/useUniversalMic";
import {
  DIRECTION_OPTIONS,
  EMOTION_OPTIONS,
  ORIGIN_OPTIONS,
} from "@/lib/labels";
import { thesisLabels } from "@/lib/thesis";
import type { AiFieldValues } from "@/lib/voiceRouting";
import type { Trade } from "@/types";
import { Direction, EmotionalState, TradeOrigin } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

/**
 * TradeForm field names. The counter-thesis reasons are named
 * `counterReason1/2/3` to match the AI voice-routing field keys in
 * `lib/voiceRouting.ts` (`AiFieldValues`), so routed values map 1:1 onto
 * form fields without translation.
 */
export type TradeFormField =
  | "symbol"
  | "direction"
  | "entryPrice"
  | "exitPrice"
  | "size"
  | "confidence"
  | "thesis"
  | "origin"
  | "emotion"
  | "counterReason1"
  | "counterReason2"
  | "counterReason3"
  | "outcome"
  | "notes";

export interface TradeFormValues {
  symbol: string;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  size: string;
  thesis: string;
  confidence: number;
  origin: TradeOrigin;
  emotion: EmotionalState;
  counterReason1: string;
  counterReason2: string;
  counterReason3: string;
  outcome: string;
  notes: string;
}

export interface TradeFormProps {
  onSubmit: (values: TradeFormValues) => void | Promise<void>;
  initialTrade?: Partial<Trade>;
  submitting?: boolean;
}

/**
 * Per-field AI suggestion + confirmation state.
 *
 * When the universal mic routes a value into a field, we mark it
 * `aiSuggested: true` and `confirmed: false`. The field renders the
 * `.ai-field` / `.ai-badge` treatment with an Accept button. Accepting (or
 * manually editing) the field promotes it to `confirmed: true` and the
 * `.ai-field-confirmed` style.
 */
interface AiFieldState {
  aiSuggested: boolean;
  confirmed: boolean;
}

type AiFieldMap = Record<TradeFormField, AiFieldState>;

const EMPTY_AI_STATE: AiFieldMap = {
  symbol: { aiSuggested: false, confirmed: false },
  direction: { aiSuggested: false, confirmed: false },
  entryPrice: { aiSuggested: false, confirmed: false },
  exitPrice: { aiSuggested: false, confirmed: false },
  size: { aiSuggested: false, confirmed: false },
  confidence: { aiSuggested: false, confirmed: false },
  thesis: { aiSuggested: false, confirmed: false },
  origin: { aiSuggested: false, confirmed: false },
  emotion: { aiSuggested: false, confirmed: false },
  counterReason1: { aiSuggested: false, confirmed: false },
  counterReason2: { aiSuggested: false, confirmed: false },
  counterReason3: { aiSuggested: false, confirmed: false },
  outcome: { aiSuggested: false, confirmed: false },
  notes: { aiSuggested: false, confirmed: false },
};

const COUNTER_FIELDS: ReadonlyArray<TradeFormField> = [
  "counterReason1",
  "counterReason2",
  "counterReason3",
];

export function TradeForm({
  onSubmit,
  initialTrade,
  submitting,
}: TradeFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TradeFormValues>({
    defaultValues: {
      symbol: initialTrade?.symbol ?? "",
      direction: (initialTrade?.direction as Direction) ?? Direction.long_,
      entryPrice: initialTrade?.entryPrice?.toString() ?? "",
      exitPrice: initialTrade?.exitPrice?.toString() ?? "",
      size: initialTrade?.positionSize?.toString() ?? "",
      thesis: initialTrade?.preTradeThesis?.thesis ?? "",
      confidence: Number(initialTrade?.confidenceRating ?? 5),
      origin:
        (initialTrade?.tradeOrigin as TradeOrigin) ?? TradeOrigin.selfGenerated,
      emotion:
        (initialTrade?.preSessionEmotion?.state as EmotionalState) ??
        EmotionalState.calm,
      counterReason1:
        initialTrade?.preTradeThesis?.counterReasons?.[0]?.text ?? "",
      counterReason2:
        initialTrade?.preTradeThesis?.counterReasons?.[1]?.text ?? "",
      counterReason3:
        initialTrade?.preTradeThesis?.counterReasons?.[2]?.text ?? "",
      outcome: initialTrade?.realizedPnl?.toString() ?? "",
      notes: initialTrade?.outcomeReasoning ?? "",
    },
  });

  const [aiState, setAiState] = useState<AiFieldMap>(() => ({
    ...EMPTY_AI_STATE,
  }));

  // Track counter reasons for the "3 required" rule.
  const counterReason1 = watch("counterReason1");
  const counterReason2 = watch("counterReason2");
  const counterReason3 = watch("counterReason3");
  const direction = watch("direction");
  const confidence = watch("confidence");

  const counterCount = useMemo(
    () =>
      [counterReason1, counterReason2, counterReason3].filter(
        (v) => v && v.trim().length > 0,
      ).length,
    [counterReason1, counterReason2, counterReason3],
  );

  const labels = useMemo(() => thesisLabels(direction), [direction]);

  // --- Universal mic integration -------------------------------------------
  // Register a field sink so AI-routed values populate the form. Each routed
  // field is marked AI-suggested + unconfirmed; the user accepts each one
  // (or edits it, which also confirms) before submit.
  const { registerFieldSink, unregisterFieldSink } = useUniversalMicContext();

  // Keep a ref to the latest setValue/aiState so the sink closure (registered
  // once) always sees fresh state without re-registering on every render.
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;
  const aiStateRef = useRef(aiState);
  aiStateRef.current = aiState;

  const applyAiValues = useCallback((values: AiFieldValues) => {
    const next: AiFieldMap = { ...aiStateRef.current };
    const setField = <K extends TradeFormField>(
      field: K,
      value: TradeFormValues[K],
    ) => {
      setValueRef.current(field, value as never, {
        shouldValidate: false,
        shouldDirty: true,
      });
      next[field] = { aiSuggested: true, confirmed: false };
    };

    if (values.symbol)
      setField("symbol", values.symbol as TradeFormValues["symbol"]);
    if (values.direction)
      setField("direction", values.direction as TradeFormValues["direction"]);
    if (values.entryPrice)
      setField(
        "entryPrice",
        values.entryPrice as TradeFormValues["entryPrice"],
      );
    if (values.exitPrice)
      setField("exitPrice", values.exitPrice as TradeFormValues["exitPrice"]);
    if (values.size) setField("size", values.size as TradeFormValues["size"]);
    if (values.thesis)
      setField("thesis", values.thesis as TradeFormValues["thesis"]);
    if (values.confidence !== undefined)
      setField(
        "confidence",
        values.confidence as TradeFormValues["confidence"],
      );
    if (values.origin)
      setField("origin", values.origin as TradeFormValues["origin"]);
    if (values.emotion)
      setField("emotion", values.emotion as TradeFormValues["emotion"]);
    if (values.counterReason1)
      setField(
        "counterReason1",
        values.counterReason1 as TradeFormValues["counterReason1"],
      );
    if (values.counterReason2)
      setField(
        "counterReason2",
        values.counterReason2 as TradeFormValues["counterReason2"],
      );
    if (values.counterReason3)
      setField(
        "counterReason3",
        values.counterReason3 as TradeFormValues["counterReason3"],
      );
    if (values.outcome)
      setField("outcome", values.outcome as TradeFormValues["outcome"]);
    if (values.notes)
      setField("notes", values.notes as TradeFormValues["notes"]);

    setAiState(next);
  }, []);

  useEffect(() => {
    registerFieldSink(applyAiValues);
    return () => unregisterFieldSink();
  }, [registerFieldSink, unregisterFieldSink, applyAiValues]);

  // --- Field helpers -------------------------------------------------------

  /** Mark a field as confirmed (Accept button or manual edit). */
  const confirmField = useCallback((field: TradeFormField) => {
    setAiState((prev) => {
      if (!prev[field].aiSuggested) return prev;
      return { ...prev, [field]: { ...prev[field], confirmed: true } };
    });
  }, []);

  /** Wrap a field control with the AI confirm treatment if it's AI-suggested. */
  const wrapAi = (field: TradeFormField, control: React.ReactNode) => (
    <AiFieldConfirm
      aiSuggested={aiState[field].aiSuggested}
      confirmed={aiState[field].confirmed}
      onAccept={() => confirmField(field)}
    >
      {control}
    </AiFieldConfirm>
  );

  /** Register a text/number input AND confirm the field on user edit. */
  const registerWithConfirm = (field: TradeFormField) => ({
    ...register(field, {
      onChange: () => {
        // User edited the field — promote it out of the unconfirmed AI state.
        if (aiState[field].aiSuggested && !aiState[field].confirmed) {
          confirmField(field);
        }
      },
    }),
  });

  const onValid = (values: TradeFormValues) => {
    const filled = [
      values.counterReason1,
      values.counterReason2,
      values.counterReason3,
    ].filter((v) => v && v.trim().length > 0);
    if (filled.length < 3) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-6">
      {/* Trade Setup ------------------------------------------------------- */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium tracking-tight">
            Trade Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Symbol</Label>
            {wrapAi(
              "symbol",
              <Input
                id="symbol"
                placeholder="AAPL"
                data-ocid="trade_form.input.symbol"
                {...registerWithConfirm("symbol")}
              />,
            )}
            {errors.symbol && (
              <p className="text-xs text-rose-400">{errors.symbol.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Direction</Label>
            {wrapAi(
              "direction",
              <Select
                value={getValues("direction")}
                onValueChange={(v) => {
                  setValue("direction", v as Direction, { shouldDirty: true });
                  if (aiState.direction.aiSuggested) confirmField("direction");
                }}
              >
                <SelectTrigger data-ocid="trade_form.select.direction">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entryPrice">Entry price</Label>
            {wrapAi(
              "entryPrice",
              <Input
                id="entryPrice"
                type="number"
                step="any"
                placeholder="0.00"
                data-ocid="trade_form.input.entry_price"
                {...registerWithConfirm("entryPrice")}
              />,
            )}
            {errors.entryPrice && (
              <p className="text-xs text-rose-400">
                {errors.entryPrice.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exitPrice">Exit price</Label>
            {wrapAi(
              "exitPrice",
              <Input
                id="exitPrice"
                type="number"
                step="any"
                placeholder="0.00"
                data-ocid="trade_form.input.exit_price"
                {...registerWithConfirm("exitPrice")}
              />,
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="size">Size (shares / contracts)</Label>
            {wrapAi(
              "size",
              <Input
                id="size"
                type="number"
                step="any"
                placeholder="0"
                data-ocid="trade_form.input.size"
                {...registerWithConfirm("size")}
              />,
            )}
            {errors.size && (
              <p className="text-xs text-rose-400">{errors.size.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confidence">
              Confidence{" "}
              <span className="font-mono text-muted-foreground">
                ({confidence})
              </span>
            </Label>
            {wrapAi(
              "confidence",
              <input
                id="confidence"
                type="range"
                min={1}
                max={10}
                step={1}
                data-ocid="trade_form.input.confidence"
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-sky-500"
                {...registerWithConfirm("confidence")}
              />,
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thesis & Context -------------------------------------------------- */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium tracking-tight">
            Thesis &amp; Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="thesis">{labels.thesis}</Label>
            {wrapAi(
              "thesis",
              <Textarea
                id="thesis"
                rows={4}
                placeholder="Why are you taking this trade?"
                data-ocid="trade_form.textarea.thesis"
                {...registerWithConfirm("thesis")}
              />,
            )}
            {errors.thesis && (
              <p className="text-xs text-rose-400">{errors.thesis.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Origin</Label>
              {wrapAi(
                "origin",
                <Select
                  value={getValues("origin")}
                  onValueChange={(v) => {
                    setValue("origin", v as TradeOrigin, { shouldDirty: true });
                    if (aiState.origin.aiSuggested) confirmField("origin");
                  }}
                >
                  <SelectTrigger data-ocid="trade_form.select.origin">
                    <SelectValue placeholder="Origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Emotional state</Label>
              {wrapAi(
                "emotion",
                <Select
                  value={getValues("emotion")}
                  onValueChange={(v) => {
                    setValue("emotion", v as EmotionalState, {
                      shouldDirty: true,
                    });
                    if (aiState.emotion.aiSuggested) confirmField("emotion");
                  }}
                >
                  <SelectTrigger data-ocid="trade_form.select.emotion">
                    <SelectValue placeholder="Emotion" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Counter-thesis ---------------------------------------------------- */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium tracking-tight">
              {labels.counter}
            </CardTitle>
            <span
              className={`font-mono text-xs ${
                counterCount >= 3 ? "text-emerald-400" : "text-amber-400"
              }`}
              data-ocid="trade_form.counter_count"
            >
              {counterCount}/3
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {COUNTER_FIELDS.map((field, i) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={field} className="text-xs text-muted-foreground">
                Reason {i + 1}
              </Label>
              {wrapAi(
                field,
                <Input
                  id={field}
                  placeholder={`${labels.counterShort} reason ${i + 1}`}
                  data-ocid={`trade_form.input.${field}`}
                  {...registerWithConfirm(field)}
                />,
              )}
            </div>
          ))}
          {counterCount < 3 && (
            <p className="text-xs text-amber-400">
              All three counter-thesis reasons are required before saving.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Outcome & Notes --------------------------------------------------- */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium tracking-tight">
            Outcome &amp; Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="outcome">Realized PnL</Label>
            {wrapAi(
              "outcome",
              <Input
                id="outcome"
                type="number"
                step="any"
                placeholder="0.00"
                data-ocid="trade_form.input.outcome"
                {...registerWithConfirm("outcome")}
              />,
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            {wrapAi(
              "notes",
              <Textarea
                id="notes"
                rows={3}
                placeholder="Post-trade reflection"
                data-ocid="trade_form.textarea.notes"
                {...registerWithConfirm("notes")}
              />,
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={submitting || counterCount < 3}
          data-ocid="trade_form.submit_button"
        >
          {submitting
            ? "Saving…"
            : initialTrade
              ? "Update trade"
              : "Save trade"}
        </Button>
      </div>
    </form>
  );
}
