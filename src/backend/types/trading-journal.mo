module {
  /// Direction of a trade.
  public type Direction = { #long; #short };

  /// Origin tag for a trade — monitors herd mentality and authority bias.
  public type TradeOrigin = { #selfGenerated; #sociallyInfluenced };

  /// Emotional state captured pre-session and during a trade.
  public type EmotionalState = {
    #calm;
    #anxious;
    #euphoric;
    #fearful;
    #greedy;
    #neutral;
  };

  /// A single counter-reason recorded in the pre-trade thesis. Direction-neutral:
  /// reasons this trade could fail regardless of long/short direction.
  public type CounterReason = {
    text : Text;
  };

  /// Pre-trade thesis — requires three explicit counter-reasons. Direction-neutral:
  /// `thesis` is the rationale for this trade, `counterReasons` are reasons it could fail.
  public type PreTradeThesis = {
    thesis : Text;
    counterReasons : [CounterReason];
  };

  /// Emotional state snapshot taken at a specific moment.
  public type EmotionalSnapshot = {
    state : EmotionalState;
    note : Text;
    capturedAtNs : Int;
  };

  /// A media attachment (screenshot, GIF, short video clip, or annotated version).
  public type MediaType = { #screenshot; #gif; #videoClip; #annotatedImage };

  public type Media = {
    id : Nat;
    tradeId : Nat;
    mediaType : MediaType;
    storageKey : Text;
    originalStorageKey : ?Text;
    caption : ?Text;
    uploadedAtNs : Int;
    source : { #userUpload; #chromeExtension };
    chartMetadata : ?ChartMetadata;
  };

  /// Optional chart metadata sent by the Chrome extension.
  public type ChartMetadata = {
    symbol : ?Text;
    timeframe : ?Text;
    price : ?Float;
  };

  /// Audio recap recording attached to a trade.
  public type AudioRecap = {
    id : Nat;
    tradeId : Nat;
    audioStorageKey : Text;
    transcript : Text;
    recordedAtNs : Int;
    durationSecs : Nat;
  };

  /// A skipped-trade note used for FOMO / regret-aversion tracking.
  public type SkippedTrade = {
    id : Nat;
    owner : Principal;
    symbol : Text;
    note : Text;
    fomoTagged : Bool;
    theoreticalPnl : ?Float;
    skippedAtNs : Int;
  };

  /// Core trade journal entry. `shareableUrl` is the per-entry shareable link
  /// derived from `id` (e.g. "/trade/<id>"); null until the trade is published
  /// or the shareable link is explicitly minted.
  public type Trade = {
    id : Nat;
    owner : Principal;
    symbol : Text;
    direction : Direction;
    entryPrice : Float;
    exitPrice : ?Float;
    positionSize : Float;
    entryAtNs : Int;
    exitAtNs : ?Int;
    holdTimeSecs : ?Nat;
    realizedPnl : ?Float;
    preTradeThesis : PreTradeThesis;
    confidenceRating : Nat; // 1..10
    tradeOrigin : TradeOrigin;
    originSourceNote : ?Text;
    preSessionEmotion : EmotionalSnapshot;
    duringTradeEmotion : ?EmotionalSnapshot;
    outcomeReasoning : ?Text;
    isDraft : Bool;
    shareableUrl : ?Text;
    createdAtNs : Int;
    updatedAtNs : Int;
  };

  /// Per-user API token for Chrome extension authentication.
  public type ApiToken = {
    tokenHash : Text;
    createdAtNs : Int;
  };

  /// Filter / sort state for the trade list view (persisted client-side in URL).
  public type TradeListFilter = {
    symbolQuery : ?Text;
    originTag : ?TradeOrigin;
    emotionalState : ?EmotionalState;
    dateFromNs : ?Int;
    dateToNs : ?Int;
    sortBy : { #dateDesc; #dateAsc; #pnlDesc; #pnlAsc };
  };

  /// Payload received from the Chrome extension capture endpoint. The extension
  /// lives on TradingView and auto-fills a complete draft trade: symbol,
  /// direction (from buy/sell), entry/exit prices, size, realized P&L, and
  /// outcome notes — in addition to the screenshot capture. All trade-shape
  /// fields are optional so the extension can send a partial capture (e.g.
  /// just a screenshot, or just the chart data without a screenshot).
  public type ExtensionCapture = {
    token : Text;
    targetTradeId : ?Nat;
    symbol : ?Text;
    timeframe : ?Text;
    price : ?Float;
    mediaStorageKey : Text;
    mediaType : MediaType;
    caption : ?Text;
    direction : ?Direction;
    entryPrice : ?Float;
    exitPrice : ?Float;
    size : ?Float;
    realizedPnl : ?Float;
    outcomeNotes : ?Text;
  };

  /// Result of attaching an extension capture to a trade.
  public type CaptureResult = {
    tradeId : Nat;
    mediaId : Nat;
    wasDraftCreated : Bool;
  };

  /// Bias signature surfaced by the weekly review.
  public type BiasSignatureType = {
    #confirmationBias;
    #dispositionEffect;
    #hotHandFallacy;
    #herdMentality;
    #overconfidence;
    #lossAversion;
    #fomoRegret;
    #statusQuoBias;
  };

  public type BiasSignature = {
    type_ : BiasSignatureType;
    tradeIds : [Nat];
    description : Text;
  };

  /// Daily analytics row — thesis completeness + confidence vs outcome.
  public type DailyTradeSummary = {
    tradeId : Nat;
    symbol : Text;
    direction : Direction;
    bearCasePresent : Bool;
    confidenceRating : Nat;
    realizedPnl : ?Float;
    enteredAtNs : Int;
  };

  /// Monthly hold-time comparison with loss-aversion flag.
  public type HoldTimeAnalysis = {
    avgWinnerHoldSecs : ?Nat;
    avgLoserHoldSecs : ?Nat;
    lossAversionFlag : Bool;
  };

  /// Monthly confidence-vs-outcome correlation.
  public type ConfidenceOutcomeAnalysis = {
    correlation : Float;
    overconfidenceFlag : Bool;
  };

  /// Monthly win-rate / profit-factor vs historical baseline.
  public type StrategyBaselineAnalysis = {
    winRate : Float;
    profitFactor : Float;
    historicalWinRate : ?Float;
    historicalProfitFactor : ?Float;
    statusQuoBiasFlag : Bool;
  };

  /// Self-assessment categorization of the last 20 trades by bias type.
  public type BiasCategoryCount = {
    type_ : BiasSignatureType;
    count : Nat;
    preventableLossEstimate : Float;
  };

  public type SelfAssessment = {
    categorizedTrades : [BiasCategoryCount];
    topBiases : [BiasSignatureType];
    progressTo20 : Nat;
    progressTo50 : Nat;
  };

  /// Targeted fix suggestion for a bias type.
  public type TargetedFix = {
    type_ : BiasSignatureType;
    suggestion : Text;
  };
};
