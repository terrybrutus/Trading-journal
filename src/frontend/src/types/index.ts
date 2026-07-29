// Re-export the generated backend types so pages import from a single,
// stable surface. These mirror `backend.d.ts` 1:1 and stay in sync via
// the bindgen step.
//
// `EmotionalState`, `MediaType`, `TradeOrigin`, `UserRole`, and the two
// `Variant_*` enums are real runtime `enum` objects in the backend bindings,
// so they are imported and re-exported as values — callers can use both the
// type (e.g. `TradeOrigin`) and the runtime namespace (e.g.
// `TradeOrigin.selfGenerated`).
import {
  Direction,
  EmotionalState,
  MediaType,
  TradeOrigin,
  UserRole,
  Variant_dateAsc_pnlAsc_pnlDesc_dateDesc,
  type Variant_userUpload_chromeExtension,
} from "@/backend";
import type {
  AudioRecap,
  BiasCategoryCount,
  BiasSignature,
  BiasSignatureType,
  CaptureResult,
  Cell,
  ChartMetadata,
  ConfidenceOutcomeAnalysis,
  CounterReason,
  DailyTradeSummary,
  EmotionalSnapshot,
  Error_,
  ExtensionCapture,
  HoldTimeAnalysis,
  Media,
  PreTradeThesis,
  Result,
  SelfAssessment,
  SkippedTrade,
  StrategyBaselineAnalysis,
  TargetedFix,
  Trade,
  TradeListFilter,
  Value,
} from "@/backend";

export type {
  AudioRecap,
  BiasCategoryCount,
  BiasSignature,
  BiasSignatureType,
  CaptureResult,
  Cell,
  ChartMetadata,
  ConfidenceOutcomeAnalysis,
  CounterReason,
  DailyTradeSummary,
  EmotionalSnapshot,
  Error_,
  ExtensionCapture,
  HoldTimeAnalysis,
  Media,
  PreTradeThesis,
  Result,
  SelfAssessment,
  SkippedTrade,
  StrategyBaselineAnalysis,
  TargetedFix,
  Trade,
  TradeListFilter,
  Value,
  Variant_userUpload_chromeExtension,
};

// Runtime enums — re-exported as values so callers can use both the type
// (e.g. `TradeOrigin`) and the runtime namespace (e.g.
// `TradeOrigin.selfGenerated`).
export {
  Direction,
  EmotionalState,
  MediaType,
  TradeOrigin,
  UserRole,
  Variant_dateAsc_pnlAsc_pnlDesc_dateDesc,
};

// Sort variant — the backend enum uses a verbose name; expose a friendlier
// alias for the rest of the app.
export type TradeSort = Variant_dateAsc_pnlAsc_pnlDesc_dateDesc;

// List result shape returned by `listTrades` / `listSkippedTrades`.
export interface ListResult<T> {
  total: bigint;
  items: T[];
}

// URL-persisted journal view state. Every field is optional and serializable
// so the view survives refresh and is shareable. `dateFrom` / `dateTo` are
// ISO date strings (yyyy-MM-dd) in the URL and converted to ns at the hook
// boundary — keeping URLs human-readable.
export interface JournalSearch {
  q?: string;
  origin?: TradeOrigin;
  emotion?: EmotionalState;
  dateFrom?: string;
  dateTo?: string;
  sort?: TradeSort;
  page?: number;
}

// Default journal search used when the URL carries no params.
export const DEFAULT_JOURNAL_SEARCH: JournalSearch = {
  sort: "dateDesc" as TradeSort,
  page: 1,
};

// Page size for the journal list. Kept small for snappy first paint.
export const JOURNAL_PAGE_SIZE = 25;
