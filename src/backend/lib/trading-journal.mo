import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Float "mo:core/Float";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Principal "mo:core/Principal";
import Random "mo:core/Random";
import Sha256 "mo:sha2/Sha256";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Types "../types/trading-journal";
import Buffer "mo:base/Buffer";

module {
  public type Trade = Types.Trade;
  public type Media = Types.Media;
  public type AudioRecap = Types.AudioRecap;
  public type SkippedTrade = Types.SkippedTrade;
  public type ApiToken = Types.ApiToken;
  public type ExtensionCapture = Types.ExtensionCapture;
  public type CaptureResult = Types.CaptureResult;
  public type TradeListFilter = Types.TradeListFilter;
  public type BiasSignature = Types.BiasSignature;
  public type DailyTradeSummary = Types.DailyTradeSummary;
  public type HoldTimeAnalysis = Types.HoldTimeAnalysis;
  public type ConfidenceOutcomeAnalysis = Types.ConfidenceOutcomeAnalysis;
  public type StrategyBaselineAnalysis = Types.StrategyBaselineAnalysis;
  public type SelfAssessment = Types.SelfAssessment;
  public type BiasCategoryCount = Types.BiasCategoryCount;
  public type TargetedFix = Types.TargetedFix;

  /// Validate that a pre-trade thesis has a non-empty thesis statement and
  /// exactly three non-empty counter-reasons (reasons this trade could fail).
  /// Direction-neutral — applies equally to long and short trades. Forces
  /// counter-confirmation-bias deliberation.
  public func validateThesis(thesis : Types.PreTradeThesis) : Bool {
    if (thesis.thesis.size() == 0) return false;
    if (thesis.counterReasons.size() != 3) return false;
    for (reason in thesis.counterReasons.vals()) {
      if (reason.text.size() == 0) return false;
    };
    true;
  };

  /// Validate that a confidence rating is in the 1..10 range.
  public func validateConfidence(rating : Nat) : Bool {
    rating >= 1 and rating <= 10;
  };

  /// Compute hold time in seconds from entry and exit timestamps (nanoseconds).
  public func computeHoldTimeSecs(entryAtNs : Int, exitAtNs : Int) : Nat {
    Int.abs(exitAtNs - entryAtNs) / 1_000_000_000;
  };

  /// Filter and sort trades by the given criteria. Filtering is case-insensitive
  /// substring match on symbol, exact match on origin/emotion, and inclusive
  /// range on entry timestamp.
  public func filterAndSortTrades(trades : [Trade], filter : TradeListFilter) : [Trade] {
    let filtered = trades.filter(
      func(t : Trade) : Bool {
        let symbolOk = switch (filter.symbolQuery) {
          case null true;
          case (?q) {
            let needle = q.toLower();
            let hay = t.symbol.toLower();
            // substring containment check
            hay.contains(#text needle);
          };
        };
        let originOk = switch (filter.originTag) {
          case null true;
          case (?o) t.tradeOrigin == o;
        };
        let emotionOk = switch (filter.emotionalState) {
          case null true;
          case (?e) t.preSessionEmotion.state == e;
        };
        let dateFromOk = switch (filter.dateFromNs) {
          case null true;
          case (?from) t.entryAtNs >= from;
        };
        let dateToOk = switch (filter.dateToNs) {
          case null true;
          case (?to) t.entryAtNs <= to;
        };
        symbolOk and originOk and emotionOk and dateFromOk and dateToOk;
      },
    );
    filtered.sort(
      func(a : Trade, b : Trade) : {
        #less;
        #equal;
        #greater;
      } {
        switch (filter.sortBy) {
          case (#dateDesc) Int.compare(b.entryAtNs, a.entryAtNs);
          case (#dateAsc) Int.compare(a.entryAtNs, b.entryAtNs);
          case (#pnlDesc) {
            let pa = switch (a.realizedPnl) { case (?v) v; case null 0.0 };
            let pb = switch (b.realizedPnl) { case (?v) v; case null 0.0 };
            Float.compare(pb, pa);
          };
          case (#pnlAsc) {
            let pa = switch (a.realizedPnl) { case (?v) v; case null 0.0 };
            let pb = switch (b.realizedPnl) { case (?v) v; case null 0.0 };
            Float.compare(pa, pb);
          };
        };
      },
    );
  };

  /// Hash an API token for secure storage using SHA-256, returned as hex text.
  public func hashToken(token : Text) : Text {
    let digest = Sha256.fromBlob(#sha256, token.encodeUtf8()).toArray();
    // Convert [Nat8] digest to lowercase hex text.
    let hexChars : [Text] = [
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f",
    ];
    let buf = Buffer.Buffer<Text>(64);
    for (byte in digest.vals()) {
      buf.add(hexChars[byte.toNat() / 16]);
      buf.add(hexChars[byte.toNat() % 16]);
    };
    buf.vals().join("");
  };

  /// Generate a new random API token string. Combines current time with a
  /// random source for unpredictability.
  public func generateToken() : async Text {
    let now = Time.now();
    let randBlob = await Random.blob();
    let hexChars : [Text] = [
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f",
    ];
    let buf = Buffer.Buffer<Text>(64);
    // Time component (base-10 is fine for token entropy).
    let timeHex = Int.abs(now).toText();
    buf.add(timeHex);
    // Random component from Random.blob() blob (returns Blob directly, not ?Blob).
    for (byte in randBlob.toArray().vals()) {
      buf.add(hexChars[byte.toNat() / 16]);
      buf.add(hexChars[byte.toNat() % 16]);
    };
    buf.vals().join("");
  };

  /// Build a daily summary row for a single trade — thesis completeness
  /// (bear case present/missing) and confidence vs outcome.
  public func toDailySummary(trade : Trade) : DailyTradeSummary {
    let bearCasePresent = validateThesis(trade.preTradeThesis);
    {
      tradeId = trade.id;
      symbol = trade.symbol;
      direction = trade.direction;
      bearCasePresent;
      confidenceRating = trade.confidenceRating;
      realizedPnl = trade.realizedPnl;
      enteredAtNs = trade.entryAtNs;
    };
  };

  /// Compute hold-time analysis across a set of trades. Splits into winners
  /// (positive P&L) and losers (negative P&L), averages hold times, and flags
  /// loss aversion when losers are held more than 2x as long as winners.
  public func computeHoldTimeAnalysis(trades : [Trade]) : HoldTimeAnalysis {
    let closed = trades.filter(
      func(t : Trade) : Bool {
        switch (t.realizedPnl, t.exitAtNs, t.holdTimeSecs) {
          case (?pnl, ?_, ?ht) pnl != 0.0;
          case _ false;
        };
      },
    );
    let winners = closed.filter(
      func(t : Trade) : Bool {
        switch (t.realizedPnl) { case (?p) p > 0.0; case _ false };
      },
    );
    let losers = closed.filter(
      func(t : Trade) : Bool {
        switch (t.realizedPnl) { case (?p) p < 0.0; case _ false };
      },
    );
    let winnerAvg : ?Nat = if (winners.size() == 0) {
      null;
    } else {
      ?(winners.foldLeft(
        0,
        func(acc, t) {
          switch (t.holdTimeSecs) { case (?ht) acc + ht; case null acc };
        },
      ) / winners.size());
    };
    let loserAvg : ?Nat = if (losers.size() == 0) {
      null;
    } else {
      ?(losers.foldLeft(
        0,
        func(acc, t) {
          switch (t.holdTimeSecs) { case (?ht) acc + ht; case null acc };
        },
      ) / losers.size());
    };
    let lossAversionFlag = switch (winnerAvg, loserAvg) {
      case (?w, ?l) l > 2 * w;
      case _ false;
    };
    {
      avgWinnerHoldSecs = winnerAvg;
      avgLoserHoldSecs = loserAvg;
      lossAversionFlag;
    };
  };

  /// Compute confidence-vs-outcome Pearson-style correlation across a set of
  /// trades. Exposes overconfidence when high-confidence trades don't
  /// outperform (correlation near zero or negative).
  public func computeConfidenceOutcome(trades : [Trade]) : ConfidenceOutcomeAnalysis {
    let closed = trades.filter(
      func(t : Trade) : Bool {
        switch (t.realizedPnl) { case (?_) true; case null false };
      },
    );
    if (closed.size() < 2) {
      return { correlation = 0.0; overconfidenceFlag = false };
    };
    let n = Float.fromInt(closed.size());
    let xs = closed.map(
      func(t) { Float.fromInt(t.confidenceRating) },
    );
    let ys = closed.map(
      func(t) {
        switch (t.realizedPnl) { case (?p) p; case null 0.0 };
      },
    );
    let sumX = xs.foldLeft(0.0, func(a, b) { a + b });
    let sumY = ys.foldLeft(0.0, func(a, b) { a + b });
    let meanX = sumX / n;
    let meanY = sumY / n;
    var cov = 0.0;
    var varX = 0.0;
    var varY = 0.0;
    for (i in closed.keys()) {
      let dx = xs[i] - meanX;
      let dy = ys[i] - meanY;
      cov += dx * dy;
      varX += dx * dx;
      varY += dy * dy;
    };
    let denom = Float.sqrt(varX * varY);
    let correlation = if (denom == 0.0) { 0.0 } else { cov / denom };
    // Overconfidence flag: high average confidence but non-positive correlation
    // (high-confidence trades don't outperform).
    let meanConfidence = sumX / n;
    let overconfidenceFlag = meanConfidence >= 7.0 and correlation <= 0.0;
    { correlation; overconfidenceFlag };
  };

  /// Compute win-rate and profit-factor vs historical baseline. Flags status
  // quo bias when deviation exceeds 25%.
  public func computeStrategyBaseline(
    trades : [Trade],
    historicalWinRate : ?Float,
    historicalProfitFactor : ?Float,
  ) : StrategyBaselineAnalysis {
    let closed = trades.filter(
      func(t : Trade) : Bool {
        switch (t.realizedPnl) { case (?_) true; case null false };
      },
    );
    let total = Float.fromInt(closed.size());
    let wins = closed.filter(
      func(t) {
        switch (t.realizedPnl) { case (?p) p > 0.0; case _ false };
      },
    );
    let grossProfit = wins.foldLeft(
      0.0,
      func(acc, t) {
        switch (t.realizedPnl) { case (?p) acc + p; case null acc };
      },
    );
    let losses = closed.filter(
      func(t) {
        switch (t.realizedPnl) { case (?p) p < 0.0; case _ false };
      },
    );
    let grossLoss = Float.abs(
      losses.foldLeft(
        0.0,
        func(acc, t) {
          switch (t.realizedPnl) { case (?p) acc + p; case null acc };
        },
      ),
    );
    let winRate = if (total == 0.0) { 0.0 } else { Float.fromInt(wins.size()) / total };
    let profitFactor = if (grossLoss == 0.0) {
      if (grossProfit > 0.0) { 1e18 } else { 0.0 };
    } else {
      grossProfit / grossLoss;
    };
    let statusQuoBiasFlag = switch (historicalWinRate, historicalProfitFactor) {
      case (?hw, ?hpf) {
        let winRateDev = if (hw == 0.0) { 0.0 } else {
          Float.abs(winRate - hw) / hw;
        };
        let pfDev = if (hpf == 0.0) { 0.0 } else {
          Float.abs(profitFactor - hpf) / hpf;
        };
        winRateDev > 0.25 or pfDev > 0.25;
      };
      case _ false;
    };
    {
      winRate;
      profitFactor;
      historicalWinRate;
      historicalProfitFactor;
      statusQuoBiasFlag;
    };
  };

  /// Categorize the last N trades by bias type and surface top offenders.
  /// Most traders find 2-3 biases account for >70% of preventable losses.
  public func categorizeBiases(trades : [Trade]) : SelfAssessment {
    // Tally per-bias counts and preventable loss estimates.
    var confirmCount = 0;
    var confirmLoss = 0.0;
    var dispCount = 0;
    var dispLoss = 0.0;
    var hotHandCount = 0;
    var hotHandLoss = 0.0;
    var herdCount = 0;
    var herdLoss = 0.0;
    var overConfCount = 0;
    var overConfLoss = 0.0;
    for (t in trades.vals()) {
      let pnl = switch (t.realizedPnl) { case (?p) p; case null 0.0 };
      let preventable = if (pnl < 0.0) { Float.abs(pnl) } else { 0.0 };
      // Confirmation bias: no documented bear case.
      if (not validateThesis(t.preTradeThesis)) {
        confirmCount += 1;
        confirmLoss += preventable;
      };
      // Disposition effect: cut winners short or held losers long.
      switch (t.realizedPnl, t.holdTimeSecs) {
        case (?p, ?ht) {
          if (p > 0.0 and ht < 60) {
            // Winner cut very short (< 1 min) — heuristic for "cut short".
            dispCount += 1;
            dispLoss += preventable;
          };
          if (p < 0.0 and ht > 3600) {
            // Loser held very long (> 1 hr) — heuristic for "held long".
            dispCount += 1;
            dispLoss += preventable;
          };
        };
        case _ ();
      };
      // Hot-hand fallacy: large position size after winning streak (heuristic:
      // position size > 2x average is a proxy).
      if (t.positionSize > 0.0) {
        hotHandCount += 0; // requires cross-trade context; counted in weekly signatures
      };
      // Herd mentality: socially influenced origin.
      if (t.tradeOrigin == #sociallyInfluenced) {
        herdCount += 1;
        herdLoss += preventable;
      };
      // Overconfidence: high confidence rating on a losing trade.
      if (t.confidenceRating >= 8 and pnl < 0.0) {
        overConfCount += 1;
        overConfLoss += preventable;
      };
    };
    let categorized = [
      { type_ = #confirmationBias; count = confirmCount; preventableLossEstimate = confirmLoss },
      { type_ = #dispositionEffect; count = dispCount; preventableLossEstimate = dispLoss },
      { type_ = #hotHandFallacy; count = hotHandCount; preventableLossEstimate = hotHandLoss },
      { type_ = #herdMentality; count = herdCount; preventableLossEstimate = herdLoss },
      { type_ = #overconfidence; count = overConfCount; preventableLossEstimate = overConfLoss },
    ];
    // Sort by preventable loss descending and pick top 2-3.
    let sorted = Array.sort<BiasCategoryCount>(
      categorized,
      func(a, b) { Float.compare(b.preventableLossEstimate, a.preventableLossEstimate) },
    );
    let topBiases = sorted.sliceToArray(0, 3).map(
      func(c) { c.type_ },
    );
    {
      categorizedTrades = sorted;
      topBiases;
      progressTo20 = Nat.min(trades.size(), 20);
      progressTo50 = Nat.min(trades.size(), 50);
    };
  };

  /// Surface weekly bias signatures from a set of trades. Scans for four
  /// patterns: no bear case (confirmation bias), disposition effect, hot-hand
  /// fallacy (position size increases after winning streaks), and herd
  /// mentality (trades entered within 30 minutes of a socially-influenced tag).
  public func detectWeeklySignatures(trades : [Trade]) : [BiasSignature] {
    var signatures = List.empty<BiasSignature>();

    // 1. Confirmation bias: trades without a documented bear case.
    let noBearCase = trades.filter(
      func(t) { not validateThesis(t.preTradeThesis) },
    );
    if (noBearCase.size() > 0) {
      ignore signatures.add({
        type_ = #confirmationBias;
        tradeIds = noBearCase.map(func(t) { t.id });
        description = "Trades executed without a documented bear case — confirmation bias.";
      });
    };

    // 2. Disposition effect: winners cut short, losers held long.
    let dispTrades = trades.filter(
      func(t) {
        switch (t.realizedPnl, t.holdTimeSecs) {
          case (?p, ?ht) {
            (p > 0.0 and ht < 60) or (p < 0.0 and ht > 3600);
          };
          case _ false;
        };
      },
    );
    if (dispTrades.size() > 0) {
      ignore signatures.add({
        type_ = #dispositionEffect;
        tradeIds = dispTrades.map(func(t) { t.id });
        description = "Winners cut short while losers held long — disposition effect.";
      });
    };

    // 3. Hot-hand fallacy: position size increases after a winning streak.
    // Sort by entry time, then detect consecutive wins followed by a size jump.
    let byTime = trades.sort(
      func(a, b) { Int.compare(a.entryAtNs, b.entryAtNs) },
    );
    let hotHandIds = List.empty<Nat>();
    var streak = 0;
    var lastWinSize = 0.0;
    for (t in byTime.vals()) {
      let pnl = switch (t.realizedPnl) { case (?p) p; case null 0.0 };
      if (pnl > 0.0) {
        streak += 1;
        lastWinSize := t.positionSize;
      } else {
        if (streak >= 2 and t.positionSize > lastWinSize * 1.5) {
          hotHandIds.add(t.id);
        };
        streak := 0;
        lastWinSize := 0.0;
      };
    };
    let hotHandArr = hotHandIds.toArray();
    if (hotHandArr.size() > 0) {
      ignore signatures.add({
        type_ = #hotHandFallacy;
        tradeIds = hotHandArr;
        description = "Position size increased after a winning streak — hot-hand fallacy.";
      });
    };

    // 4. Herd mentality: trades entered within 30 minutes of a socially-influenced origin tag.
    let social = trades.filter(
      func(t) { t.tradeOrigin == #sociallyInfluenced },
    );
    let herdIds = List.empty<Nat>();
    for (t in social.vals()) {
      // Check if any other trade was entered within 30 min (1.8e12 ns) of this one.
      let nearby = trades.find(
        func(other) {
          other.id != t.id and Int.abs(other.entryAtNs - t.entryAtNs) <= 1_800_000_000_000;
        },
      );
      switch (nearby) {
        case (?_) herdIds.add(t.id);
        case null ();
      };
    };
    let herdArr = herdIds.toArray();
    if (herdArr.size() > 0) {
      ignore signatures.add({
        type_ = #herdMentality;
        tradeIds = herdArr;
        description = "Trades entered within 30 minutes of a socially-influenced tag — herd mentality.";
      });
    };

    signatures.toArray();
  };

  /// Provide a targeted fix suggestion for a given bias type.
  public func targetedFixFor(biasType : Types.BiasSignatureType) : TargetedFix {
    let suggestion = switch (biasType) {
      case (#confirmationBias) "Tighten your pre-trade thesis requirements — require three explicit bear-case reasons before entry.";
      case (#dispositionEffect) "Use automated stop-loss orders to remove emotion from exits, or weekly ask whether you would still enter your open positions at current prices.";
      case (#hotHandFallacy) "Remove discretionary position sizing — stick to a fixed-percentage model until your data proves a sustainable edge.";
      case (#herdMentality) "Add a 30-minute delay between seeing a trade on social media and executing it; document your own independent thesis first.";
      case (#overconfidence) "Cap confidence ratings at 7 until your data shows high-confidence trades actually outperform.";
      case (#lossAversion) "Set a maximum hold time for losing trades and review weekly whether you are honoring your exit rules.";
      case (#fomoRegret) "Track every skipped trade with a theoretical P&L; review monthly to see if skipping was the right call.";
      case (#statusQuoBias) "Re-baseline your strategy metrics monthly; if win rate or profit factor deviates >25%, adapt your approach.";
    };
    { type_ = biasType; suggestion };
  };
};
