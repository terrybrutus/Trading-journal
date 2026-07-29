import { Direction, EmotionalState, TradeOrigin } from "@/types";

/**
 * Human-readable label maps for backend enum variants.
 *
 * Backend enums use raw camelCase variant strings (e.g. `selfGenerated`,
 * `sociallyInfluenced`). These maps translate each variant into title-case
 * copy with proper word separation so dropdowns, badges, and detail views
 * never show raw enum strings to users.
 */

const ORIGIN_LABELS: Record<TradeOrigin, string> = {
  [TradeOrigin.selfGenerated]: "Self-generated",
  [TradeOrigin.sociallyInfluenced]: "Socially influenced",
};

const EMOTION_LABELS: Record<EmotionalState, string> = {
  [EmotionalState.calm]: "Calm",
  [EmotionalState.anxious]: "Anxious",
  [EmotionalState.fearful]: "Fearful",
  [EmotionalState.greedy]: "Greedy",
  [EmotionalState.euphoric]: "Euphoric",
  [EmotionalState.neutral]: "Neutral",
};

const DIRECTION_LABELS: Record<Direction, string> = {
  [Direction.long_]: "Long",
  [Direction.short_]: "Short",
};

/** Human-readable label for a `TradeOrigin` variant. */
export function originLabel(origin: TradeOrigin): string {
  return ORIGIN_LABELS[origin] ?? origin;
}

/** Human-readable label for an `EmotionalState` variant. */
export function emotionLabel(emotion: EmotionalState): string {
  return EMOTION_LABELS[emotion] ?? emotion;
}

/** Human-readable label for a `Direction` variant. */
export function directionLabel(direction: Direction): string {
  return DIRECTION_LABELS[direction] ?? direction;
}

/** All `TradeOrigin` variants paired with their human-readable labels. */
export const ORIGIN_OPTIONS: ReadonlyArray<{
  value: TradeOrigin;
  label: string;
}> = (Object.keys(ORIGIN_LABELS) as TradeOrigin[]).map((value) => ({
  value,
  label: ORIGIN_LABELS[value],
}));

/** All `EmotionalState` variants paired with their human-readable labels. */
export const EMOTION_OPTIONS: ReadonlyArray<{
  value: EmotionalState;
  label: string;
}> = (Object.keys(EMOTION_LABELS) as EmotionalState[]).map((value) => ({
  value,
  label: EMOTION_LABELS[value],
}));

/** All `Direction` variants paired with their human-readable labels. */
export const DIRECTION_OPTIONS: ReadonlyArray<{
  value: Direction;
  label: string;
}> = (Object.keys(DIRECTION_LABELS) as Direction[]).map((value) => ({
  value,
  label: DIRECTION_LABELS[value],
}));
