import { Direction, EmotionalState, TradeOrigin } from "@/types";

/**
 * Field-value mappings produced by the AI voice router.
 *
 * The universal mic captures speech, transcribes it, and asks a cheap LLM to
 * extract structured trade-form fields from the transcript. The result is a
 * partial map keyed by the form field names that `TradeForm` consumes. Only
 * fields the model confidently extracts are present; everything else stays
 * `undefined` so the form keeps its existing value.
 *
 * Each value is tagged `aiSuggested: true` so the form can render the
 * `.ai-field` / `.ai-badge` treatment until the user accepts it.
 */
export interface AiFieldValues {
  symbol?: string;
  direction?: Direction;
  entryPrice?: string;
  exitPrice?: string;
  size?: string;
  thesis?: string;
  confidence?: number;
  origin?: TradeOrigin;
  emotion?: EmotionalState;
  counterReason1?: string;
  counterReason2?: string;
  counterReason3?: string;
  outcome?: string;
  notes?: string;
}

/** Metadata for a single AI-suggested field value. */
export interface AiSuggestedField<T = string | number | undefined> {
  value: T;
  /** Whether the user has accepted this AI suggestion. */
  confirmed: boolean;
}

/**
 * Storage key for the OpenAI API key. The Settings page (next wave) will write
 * here; the universal mic reads it. Kept under a namespaced key so it does
 * not collide with other app storage.
 */
export const OPENAI_API_KEY_STORAGE = "quantum.openaiApiKey";

/**
 * Default model for voice-to-field routing. `gpt-4o-mini` is the cheapest
 * OpenAI model that reliably returns structured JSON from a trade transcript.
 */
export const VOICE_ROUTING_MODEL = "gpt-4o-mini";

/** Read the user's OpenAI API key from local storage, if present. */
export function getOpenAiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(OPENAI_API_KEY_STORAGE);
  } catch {
    return null;
  }
}

/** Persist the user's OpenAI API key to local storage. */
export function setOpenAiApiKey(key: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (key && key.trim().length > 0) {
      window.localStorage.setItem(OPENAI_API_KEY_STORAGE, key.trim());
    } else {
      window.localStorage.removeItem(OPENAI_API_KEY_STORAGE);
    }
  } catch {
    // Storage may be unavailable (private mode); fail silently.
  }
}

/**
 * JSON schema description embedded in the system prompt so the model knows
 * which fields to extract and which enum strings to emit.
 */
const FIELD_INSTRUCTIONS = `Extract trade-form fields from the transcript. Return ONLY a JSON object with any of these keys that are clearly mentioned:
- symbol (string, ticker like "AAPL" or "BTCUSD")
- direction ("long" or "short")
- entryPrice (number)
- exitPrice (number)
- size (number, position size)
- thesis (string, the primary trade thesis)
- confidence (integer 1-10)
- origin ("selfGenerated" or "sociallyInfluenced")
- emotion ("calm", "anxious", "fearful", "greedy", "euphoric", or "neutral")
- counterReason1, counterReason2, counterReason3 (strings, up to 3 counter-thesis reasons)
- outcome (number, realized P&L)
- notes (string, outcome reasoning / free-form notes)
Omit any key that is not clearly stated. Do not invent values. Return {} if nothing matches.`;

/**
 * Route a transcript to the cheap LLM and return extracted field values.
 *
 * Uses OpenAI's `gpt-4o-mini` with JSON mode. Throws if no API key is
 * configured or the request fails — the caller is responsible for surfacing
 * the error to the user.
 */
export async function routeTranscriptToFields(
  transcript: string,
): Promise<AiFieldValues> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key configured. Add one in Settings to use voice routing.",
    );
  }
  const trimmed = transcript.trim();
  if (trimmed.length === 0) return {};

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOICE_ROUTING_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: FIELD_INSTRUCTIONS,
        },
        { role: "user", content: trimmed },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Voice routing failed (${res.status}). ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return {};
  }
  return normalizeAiFields(parsed as Record<string, unknown>);
}

/**
 * Coerce the raw LLM JSON into a typed `AiFieldValues`, validating enum
 * values and dropping anything that does not match the expected shape.
 */
function normalizeAiFields(raw: Record<string, unknown>): AiFieldValues {
  const out: AiFieldValues = {};
  if (typeof raw.symbol === "string" && raw.symbol.trim()) {
    out.symbol = (raw.symbol as string).trim().toUpperCase();
  }
  if (raw.direction === "long" || raw.direction === Direction.long_) {
    out.direction = Direction.long_;
  } else if (raw.direction === "short" || raw.direction === Direction.short_) {
    out.direction = Direction.short_;
  }
  out.entryPrice = numToStr(raw.entryPrice);
  out.exitPrice = numToStr(raw.exitPrice);
  out.size = numToStr(raw.size);
  if (typeof raw.thesis === "string" && raw.thesis.trim()) {
    out.thesis = (raw.thesis as string).trim();
  }
  if (
    typeof raw.confidence === "number" &&
    raw.confidence >= 1 &&
    raw.confidence <= 10
  ) {
    out.confidence = Math.round(raw.confidence);
  } else if (typeof raw.confidence === "string") {
    const n = Number(raw.confidence);
    if (Number.isFinite(n) && n >= 1 && n <= 10) out.confidence = Math.round(n);
  }
  if (
    raw.origin === "selfGenerated" ||
    raw.origin === TradeOrigin.selfGenerated
  ) {
    out.origin = TradeOrigin.selfGenerated;
  } else if (
    raw.origin === "sociallyInfluenced" ||
    raw.origin === TradeOrigin.sociallyInfluenced
  ) {
    out.origin = TradeOrigin.sociallyInfluenced;
  }
  if (isEmotionalState(raw.emotion)) {
    out.emotion = raw.emotion as EmotionalState;
  }
  out.counterReason1 = strOrUndef(raw.counterReason1);
  out.counterReason2 = strOrUndef(raw.counterReason2);
  out.counterReason3 = strOrUndef(raw.counterReason3);
  out.outcome = numToStr(raw.outcome);
  if (typeof raw.notes === "string" && raw.notes.trim()) {
    out.notes = (raw.notes as string).trim();
  }
  return out;
}

function numToStr(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return v.trim();
  }
  return undefined;
}

function strOrUndef(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

const EMOTION_VALUES = new Set<string>(Object.values(EmotionalState));
function isEmotionalState(v: unknown): v is EmotionalState {
  return typeof v === "string" && EMOTION_VALUES.has(v);
}
