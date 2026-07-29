import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export interface CounterReason {
    text: string;
}
export interface BiasSignature {
    tradeIds: Array<bigint>;
    type: BiasSignatureType;
    description: string;
}
export interface TargetedFix {
    type: BiasSignatureType;
    suggestion: string;
}
export interface BiasCategoryCount {
    count: bigint;
    type: BiasSignatureType;
    preventableLossEstimate: number;
}
export interface TradeListFilter {
    sortBy: Variant_dateAsc_pnlAsc_pnlDesc_dateDesc;
    dateFromNs?: bigint;
    emotionalState?: EmotionalState;
    symbolQuery?: string;
    dateToNs?: bigint;
    originTag?: TradeOrigin;
}
export interface ConfidenceOutcomeAnalysis {
    overconfidenceFlag: boolean;
    correlation: number;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface Media {
    id: bigint;
    uploadedAtNs: bigint;
    source: Variant_userUpload_chromeExtension;
    tradeId: bigint;
    originalStorageKey?: string;
    storageKey: string;
    caption?: string;
    mediaType: MediaType;
    chartMetadata?: ChartMetadata;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export interface SkippedTrade {
    id: bigint;
    skippedAtNs: bigint;
    fomoTagged: boolean;
    owner: Principal;
    note: string;
    theoreticalPnl?: number;
    symbol: string;
}
export interface StrategyBaselineAnalysis {
    statusQuoBiasFlag: boolean;
    historicalWinRate?: number;
    winRate: number;
    historicalProfitFactor?: number;
    profitFactor: number;
}
export interface HoldTimeAnalysis {
    avgLoserHoldSecs?: bigint;
    avgWinnerHoldSecs?: bigint;
    lossAversionFlag: boolean;
}
export interface PreTradeThesis {
    thesis: string;
    counterReasons: Array<CounterReason>;
}
export interface Trade {
    id: bigint;
    exitAtNs?: bigint;
    entryAtNs: bigint;
    direction: Direction;
    updatedAtNs: bigint;
    tradeOrigin: TradeOrigin;
    owner: Principal;
    createdAtNs: bigint;
    duringTradeEmotion?: EmotionalSnapshot;
    confidenceRating: bigint;
    originSourceNote?: string;
    positionSize: number;
    isDraft: boolean;
    preTradeThesis: PreTradeThesis;
    realizedPnl?: number;
    shareableUrl?: string;
    entryPrice: number;
    preSessionEmotion: EmotionalSnapshot;
    exitPrice?: number;
    holdTimeSecs?: bigint;
    symbol: string;
    outcomeReasoning?: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface DailyTradeSummary {
    direction: Direction;
    enteredAtNs: bigint;
    confidenceRating: bigint;
    bearCasePresent: boolean;
    tradeId: bigint;
    realizedPnl?: number;
    symbol: string;
}
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export interface CaptureResult {
    tradeId: bigint;
    wasDraftCreated: boolean;
    mediaId: bigint;
}
export interface ExtensionCapture {
    direction?: Direction;
    token: string;
    timeframe?: string;
    outcomeNotes?: string;
    size?: number;
    realizedPnl?: number;
    caption?: string;
    mediaType: MediaType;
    entryPrice?: number;
    targetTradeId?: bigint;
    price?: number;
    exitPrice?: number;
    mediaStorageKey: string;
    symbol?: string;
}
export interface EmotionalSnapshot {
    note: string;
    state: EmotionalState;
    capturedAtNs: bigint;
}
export interface SelfAssessment {
    categorizedTrades: Array<BiasCategoryCount>;
    topBiases: Array<BiasSignatureType>;
    progressTo20: bigint;
    progressTo50: bigint;
}
export interface ChartMetadata {
    timeframe?: string;
    price?: number;
    symbol?: string;
}
export interface AudioRecap {
    id: bigint;
    durationSecs: bigint;
    audioStorageKey: string;
    tradeId: bigint;
    recordedAtNs: bigint;
    transcript: string;
}
export enum BiasSignatureType {
    confirmationBias = "confirmationBias",
    herdMentality = "herdMentality",
    statusQuoBias = "statusQuoBias",
    dispositionEffect = "dispositionEffect",
    fomoRegret = "fomoRegret",
    overconfidence = "overconfidence",
    lossAversion = "lossAversion",
    hotHandFallacy = "hotHandFallacy"
}
export enum Direction {
    long_ = "long",
    short_ = "short"
}
export enum EmotionalState {
    greedy = "greedy",
    fearful = "fearful",
    anxious = "anxious",
    calm = "calm",
    euphoric = "euphoric",
    neutral = "neutral"
}
export enum MediaType {
    gif = "gif",
    videoClip = "videoClip",
    annotatedImage = "annotatedImage",
    screenshot = "screenshot"
}
export enum TradeOrigin {
    sociallyInfluenced = "sociallyInfluenced",
    selfGenerated = "selfGenerated"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum Variant_dateAsc_pnlAsc_pnlDesc_dateDesc {
    dateAsc = "dateAsc",
    pnlAsc = "pnlAsc",
    pnlDesc = "pnlDesc",
    dateDesc = "dateDesc"
}
export enum Variant_userUpload_chromeExtension {
    userUpload = "userUpload",
    chromeExtension = "chromeExtension"
}
export interface backendInterface {
    addAudioRecapToTrade(tradeId: bigint, recap: {
        durationSecs: bigint;
        audioStorageKey: string;
        transcript: string;
    }): Promise<AudioRecap>;
    addMediaToTrade(tradeId: bigint, media: {
        originalStorageKey?: string;
        storageKey: string;
        caption?: string;
        mediaType: MediaType;
        chartMetadata?: ChartMetadata;
    }): Promise<Media>;
    addSkippedTrade(input: {
        fomoTagged: boolean;
        note: string;
        theoreticalPnl?: number;
        symbol: string;
    }): Promise<SkippedTrade>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createTrade(input: {
        exitAtNs?: bigint;
        entryAtNs: bigint;
        direction: Direction;
        tradeOrigin: TradeOrigin;
        duringTradeEmotion?: EmotionalSnapshot;
        confidenceRating: bigint;
        originSourceNote?: string;
        positionSize: number;
        isDraft: boolean;
        preTradeThesis: PreTradeThesis;
        realizedPnl?: number;
        entryPrice: number;
        preSessionEmotion: EmotionalSnapshot;
        exitPrice?: number;
        symbol: string;
        outcomeReasoning?: string;
    }): Promise<bigint>;
    deleteMedia(tradeId: bigint, mediaId: bigint): Promise<boolean>;
    deleteTrade(tradeId: bigint): Promise<boolean>;
    execute(qJson: string): Promise<Result>;
    generateApiToken(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    getDailySummary(dayStartNs: bigint): Promise<Array<DailyTradeSummary>>;
    getMonthlyConfidenceOutcome(monthStartNs: bigint, monthEndNs: bigint): Promise<ConfidenceOutcomeAnalysis>;
    getMonthlyFomoAnalysis(monthStartNs: bigint, monthEndNs: bigint): Promise<{
        fomoTaggedTradeIds: Array<bigint>;
        skippedTrades: Array<SkippedTrade>;
        theoreticalPnlTotal: number;
    }>;
    getMonthlyHoldTimeAnalysis(monthStartNs: bigint, monthEndNs: bigint): Promise<HoldTimeAnalysis>;
    getMonthlyStrategyBaseline(monthStartNs: bigint, monthEndNs: bigint): Promise<StrategyBaselineAnalysis>;
    getSelfAssessment(): Promise<SelfAssessment>;
    getTargetedFixes(biasTypes: Array<BiasSignatureType>): Promise<Array<TargetedFix>>;
    getTrade(tradeId: bigint): Promise<Trade | null>;
    getWeeklySignatures(weekStartNs: bigint, weekEndNs: bigint): Promise<Array<BiasSignature>>;
    hasApiToken(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    listAudioRecapsForTrade(tradeId: bigint): Promise<Array<AudioRecap>>;
    listMediaForTrade(tradeId: bigint): Promise<Array<Media>>;
    listSkippedTrades(limit: bigint, offset: bigint): Promise<{
        total: bigint;
        items: Array<SkippedTrade>;
    }>;
    listTrades(filter: TradeListFilter, limit: bigint, offset: bigint): Promise<{
        total: bigint;
        items: Array<Trade>;
    }>;
    receiveExtensionCapture(capture: ExtensionCapture): Promise<CaptureResult>;
    regenerateApiToken(): Promise<string>;
    schema(): Promise<string>;
    updateTrade(tradeId: bigint, updates: {
        exitAtNs?: bigint;
        duringTradeEmotion?: EmotionalSnapshot;
        confidenceRating?: bigint;
        isDraft?: boolean;
        realizedPnl?: number;
        exitPrice?: number;
        outcomeReasoning?: string;
    }): Promise<Trade>;
}
