import { Direction } from "@/types";

/**
 * Direction-aware thesis labels.
 *
 * The thesis and counter-thesis copy must reflect the chosen direction so
 * the form never labels a short trade's thesis as "Bull thesis". This helper
 * returns the correct pair of labels based on direction:
 *
 * - `long`  → thesis "Bull thesis", counter "Bear Case — 3 reasons required"
 * - `short` → thesis "Bear thesis", counter "Bull Case — 3 reasons required"
 * - none    → neutral "Thesis", counter "Counter-thesis — 3 reasons required"
 *
 * The terminology is direction-neutral at the structural level (thesis vs
 * counter-thesis) while the directional framing (bull/bear) follows the
 * trade's actual direction.
 */
export interface ThesisLabels {
  /** Label for the primary thesis field/card. */
  thesis: string;
  /** Label for the counter-thesis card, including the 3-reasons requirement. */
  counter: string;
  /** Short label for the counter-thesis card header (without the requirement suffix). */
  counterShort: string;
}

const COUNTER_SUFFIX = "— 3 reasons required";

export function thesisLabels(
  direction: Direction | undefined | null,
): ThesisLabels {
  if (direction === Direction.long_) {
    return {
      thesis: "Bull thesis",
      counter: `Bear Case ${COUNTER_SUFFIX}`,
      counterShort: "Bear Case",
    };
  }
  if (direction === Direction.short_) {
    return {
      thesis: "Bear thesis",
      counter: `Bull Case ${COUNTER_SUFFIX}`,
      counterShort: "Bull Case",
    };
  }
  return {
    thesis: "Thesis",
    counter: `Counter-thesis ${COUNTER_SUFFIX}`,
    counterShort: "Counter-thesis",
  };
}
