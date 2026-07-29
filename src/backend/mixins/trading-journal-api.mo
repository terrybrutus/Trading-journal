import Array "mo:core/Array";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Types "../types/trading-journal";
import TradingJournal "../lib/trading-journal";

mixin (
  trades : Map.Map<Nat, Types.Trade>,
  mediaByTrade : Map.Map<Nat, List.List<Types.Media>>,
  audioByTrade : Map.Map<Nat, List.List<Types.AudioRecap>>,
  skippedTrades : Map.Map<Nat, Types.SkippedTrade>,
  apiTokens : Map.Map<Principal, Types.ApiToken>,
  tradeState : { var nextTradeId : Nat; var nextMediaId : Nat; var nextAudioId : Nat; var nextSkippedTradeId : Nat }
) {
  /// Build the per-trade shareable URL. Relative path the frontend resolves
  /// to the full origin: "/trades/{tradeId}".
  func shareableUrlFor(tradeId : Nat) : Text {
    "/trades/".concat(tradeId.toText());
  };

  /// Create a new trade entry. Requires three bear-case reasons before saving.
  public shared ({ caller }) func createTrade(input : {
    symbol : Text;
    direction : Types.Direction;
    entryPrice : Float;
    exitPrice : ?Float;
    positionSize : Float;
    entryAtNs : Int;
    exitAtNs : ?Int;
    preTradeThesis : Types.PreTradeThesis;
    confidenceRating : Nat;
    tradeOrigin : Types.TradeOrigin;
    originSourceNote : ?Text;
    preSessionEmotion : Types.EmotionalSnapshot;
    duringTradeEmotion : ?Types.EmotionalSnapshot;
    realizedPnl : ?Float;
    outcomeReasoning : ?Text;
    isDraft : Bool;
  }) : async Nat {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    if (not TradingJournal.validateThesis(input.preTradeThesis)) {
      Runtime.trap("Invalid thesis: three non-empty bear-case reasons are required");
    };
    if (not TradingJournal.validateConfidence(input.confidenceRating)) {
      Runtime.trap("Invalid confidence rating: must be between 1 and 10");
    };
    let now = Time.now();
    let holdTimeSecs = switch (input.exitAtNs) {
      case (?exit) ?TradingJournal.computeHoldTimeSecs(input.entryAtNs, exit);
      case null null;
    };
    let tradeId = tradeState.nextTradeId;
    tradeState.nextTradeId := tradeId + 1;
    let trade : Types.Trade = {
      id = tradeId;
      owner = caller;
      symbol = input.symbol;
      direction = input.direction;
      entryPrice = input.entryPrice;
      exitPrice = input.exitPrice;
      positionSize = input.positionSize;
      entryAtNs = input.entryAtNs;
      exitAtNs = input.exitAtNs;
      holdTimeSecs;
      realizedPnl = input.realizedPnl;
      preTradeThesis = input.preTradeThesis;
      confidenceRating = input.confidenceRating;
      tradeOrigin = input.tradeOrigin;
      originSourceNote = input.originSourceNote;
      preSessionEmotion = input.preSessionEmotion;
      duringTradeEmotion = input.duringTradeEmotion;
      outcomeReasoning = input.outcomeReasoning;
      isDraft = input.isDraft;
      shareableUrl = ?shareableUrlFor(tradeId);
      createdAtNs = now;
      updatedAtNs = now;
    };
    trades.add(tradeId, trade);
    tradeId;
  };

  /// Update an existing trade entry. Owner-only.
  public shared ({ caller }) func updateTrade(tradeId : Nat, updates : {
    exitPrice : ?Float;
    exitAtNs : ?Int;
    realizedPnl : ?Float;
    outcomeReasoning : ?Text;
    duringTradeEmotion : ?Types.EmotionalSnapshot;
    confidenceRating : ?Nat;
    isDraft : ?Bool;
  }) : async Types.Trade {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let existing = switch (trades.get(tradeId)) {
      case (?t) t;
      case null Runtime.trap("Trade not found");
    };
    if (existing.owner != caller) Runtime.trap("Unauthorized: not the trade owner");
    let newConfidence = switch (updates.confidenceRating) {
      case (?r) {
        if (not TradingJournal.validateConfidence(r)) {
          Runtime.trap("Invalid confidence rating: must be between 1 and 10");
        };
        r;
      };
      case null existing.confidenceRating;
    };
    let newExitAtNs = switch (updates.exitAtNs) {
      case (?v) ?v;
      case null existing.exitAtNs;
    };
    let newHoldTimeSecs = switch (newExitAtNs) {
      case (?exit) ?TradingJournal.computeHoldTimeSecs(existing.entryAtNs, exit);
      case null existing.holdTimeSecs;
    };
    let updated : Types.Trade = {
      existing with
      exitPrice = switch (updates.exitPrice) {
        case (?v) ?v;
        case null existing.exitPrice;
      };
      exitAtNs = newExitAtNs;
      holdTimeSecs = newHoldTimeSecs;
      realizedPnl = switch (updates.realizedPnl) {
        case (?v) ?v;
        case null existing.realizedPnl;
      };
      outcomeReasoning = switch (updates.outcomeReasoning) {
        case (?v) ?v;
        case null existing.outcomeReasoning;
      };
      duringTradeEmotion = switch (updates.duringTradeEmotion) {
        case (?v) ?v;
        case null existing.duringTradeEmotion;
      };
      confidenceRating = newConfidence;
      isDraft = switch (updates.isDraft) {
        case (?v) v;
        case null existing.isDraft;
      };
      // Backfill shareableUrl for trades created before this field was
      // populated at creation time.
      shareableUrl = switch (existing.shareableUrl) {
        case (?u) ?u;
        case null ?shareableUrlFor(tradeId);
      };
      updatedAtNs = Time.now();
    };
    trades.add(tradeId, updated);
    updated;
  };

  /// Delete a trade entry and its associated media/audio. Owner-only.
  public shared ({ caller }) func deleteTrade(tradeId : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let existing = switch (trades.get(tradeId)) {
      case (?t) t;
      case null return false;
    };
    if (existing.owner != caller) Runtime.trap("Unauthorized: not the trade owner");
    trades.remove(tradeId);
    mediaByTrade.remove(tradeId);
    audioByTrade.remove(tradeId);
    true;
  };

  /// Get a single trade by id. Owner-only. Backfills shareableUrl on read for
  /// trades created before that field was populated at creation time; the
  /// persisted backfill happens on the next updateTrade.
  public query ({ caller }) func getTrade(tradeId : Nat) : async ?Types.Trade {
    if (caller.isAnonymous()) return null;
    switch (trades.get(tradeId)) {
      case (?t) {
        if (t.owner != caller) return null;
        switch (t.shareableUrl) {
          case (?u) ?t;
          case null ?{ t with shareableUrl = ?shareableUrlFor(tradeId) };
        };
      };
      case null null;
    };
  };

  /// List the caller's trades with filter, sort, and pagination.
  public query ({ caller }) func listTrades(filter : Types.TradeListFilter, limit : Nat, offset : Nat) : async {
    items : [Types.Trade];
    total : Nat;
  } {
    if (caller.isAnonymous()) {
      return { items = []; total = 0 };
    };
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool { t.owner == caller },
    );
    let sorted = TradingJournal.filterAndSortTrades(owned, filter);
    let total = sorted.size();
    let items = if (offset >= total) {
      [];
    } else {
      let remaining = total - offset;
      let take = if (limit < remaining) limit else remaining;
      sorted.sliceToArray(offset, offset + take);
    };
    { items; total };
  };

  /// Upload media (screenshot, GIF, video clip) to a trade. Owner-only.
  public shared ({ caller }) func addMediaToTrade(tradeId : Nat, media : {
    mediaType : Types.MediaType;
    storageKey : Text;
    originalStorageKey : ?Text;
    caption : ?Text;
    chartMetadata : ?Types.ChartMetadata;
  }) : async Types.Media {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let trade = switch (trades.get(tradeId)) {
      case (?t) t;
      case null Runtime.trap("Trade not found");
    };
    if (trade.owner != caller) Runtime.trap("Unauthorized: not the trade owner");
    let mediaId = tradeState.nextMediaId;
    tradeState.nextMediaId := mediaId + 1;
    let record : Types.Media = {
      id = mediaId;
      tradeId;
      mediaType = media.mediaType;
      storageKey = media.storageKey;
      originalStorageKey = media.originalStorageKey;
      caption = media.caption;
      uploadedAtNs = Time.now();
      source = #userUpload;
      chartMetadata = media.chartMetadata;
    };
    let existing = switch (mediaByTrade.get(tradeId)) {
      case (?l) l;
      case null List.empty<Types.Media>();
    };
    existing.add(record);
    mediaByTrade.add(tradeId, existing);
    record;
  };

  /// List all media attached to a trade. Owner-only.
  public query ({ caller }) func listMediaForTrade(tradeId : Nat) : async [Types.Media] {
    if (caller.isAnonymous()) return [];
    let trade = switch (trades.get(tradeId)) {
      case (?t) t;
      case null return [];
    };
    if (trade.owner != caller) return [];
    switch (mediaByTrade.get(tradeId)) {
      case (?l) l.toArray();
      case null [];
    };
  };

  /// Delete a media attachment. Owner-only.
  public shared ({ caller }) func deleteMedia(tradeId : Nat, mediaId : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let trade = switch (trades.get(tradeId)) {
      case (?t) t;
      case null return false;
    };
    if (trade.owner != caller) Runtime.trap("Unauthorized: not the trade owner");
    switch (mediaByTrade.get(tradeId)) {
      case (?l) {
        let kept = l.filter(func(m : Types.Media) : Bool { m.id != mediaId });
        mediaByTrade.add(tradeId, kept);
        true;
      };
      case null false;
    };
  };

  /// Attach an audio recap recording to a trade. Owner-only.
  public shared ({ caller }) func addAudioRecapToTrade(tradeId : Nat, recap : {
    audioStorageKey : Text;
    transcript : Text;
    durationSecs : Nat;
  }) : async Types.AudioRecap {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let trade = switch (trades.get(tradeId)) {
      case (?t) t;
      case null Runtime.trap("Trade not found");
    };
    if (trade.owner != caller) Runtime.trap("Unauthorized: not the trade owner");
    let audioId = tradeState.nextAudioId;
    tradeState.nextAudioId := audioId + 1;
    let record : Types.AudioRecap = {
      id = audioId;
      tradeId;
      audioStorageKey = recap.audioStorageKey;
      transcript = recap.transcript;
      recordedAtNs = Time.now();
      durationSecs = recap.durationSecs;
    };
    let existing = switch (audioByTrade.get(tradeId)) {
      case (?l) l;
      case null List.empty<Types.AudioRecap>();
    };
    existing.add(record);
    audioByTrade.add(tradeId, existing);
    record;
  };

  /// List audio recaps for a trade. Owner-only.
  public query ({ caller }) func listAudioRecapsForTrade(tradeId : Nat) : async [Types.AudioRecap] {
    if (caller.isAnonymous()) return [];
    let trade = switch (trades.get(tradeId)) {
      case (?t) t;
      case null return [];
    };
    if (trade.owner != caller) return [];
    switch (audioByTrade.get(tradeId)) {
      case (?l) l.toArray();
      case null [];
    };
  };

  /// Record a skipped trade for FOMO / regret-aversion tracking. Owner-only.
  public shared ({ caller }) func addSkippedTrade(input : {
    symbol : Text;
    note : Text;
    fomoTagged : Bool;
    theoreticalPnl : ?Float;
  }) : async Types.SkippedTrade {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let id = tradeState.nextSkippedTradeId;
    tradeState.nextSkippedTradeId := id + 1;
    let record : Types.SkippedTrade = {
      id;
      owner = caller;
      symbol = input.symbol;
      note = input.note;
      fomoTagged = input.fomoTagged;
      theoreticalPnl = input.theoreticalPnl;
      skippedAtNs = Time.now();
    };
    skippedTrades.add(id, record);
    record;
  };

  /// List the caller's skipped trades.
  public query ({ caller }) func listSkippedTrades(limit : Nat, offset : Nat) : async {
    items : [Types.SkippedTrade];
    total : Nat;
  } {
    if (caller.isAnonymous()) {
      return { items = []; total = 0 };
    };
    let owned = skippedTrades.values().toArray().filter(
      func(s : Types.SkippedTrade) : Bool { s.owner == caller },
    );
    let total = owned.size();
    let items = if (offset >= total) {
      [];
    } else {
      let remaining = total - offset;
      let take = if (limit < remaining) limit else remaining;
      owned.sliceToArray(offset, offset + take);
    };
    { items; total };
  };

  /// Generate a new per-user API token for the Chrome extension. Returns the
  /// plaintext token once; only the hash is stored. Owner-only.
  public shared ({ caller }) func generateApiToken() : async Text {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let token = await TradingJournal.generateToken();
    apiTokens.add(caller, {
      tokenHash = TradingJournal.hashToken(token);
      createdAtNs = Time.now();
    });
    token;
  };

  /// Regenerate the per-user API token, invalidating the previous one. Owner-only.
  public shared ({ caller }) func regenerateApiToken() : async Text {
    if (caller.isAnonymous()) Runtime.trap("Unauthorized: anonymous caller");
    let token = await TradingJournal.generateToken();
    apiTokens.add(caller, {
      tokenHash = TradingJournal.hashToken(token);
      createdAtNs = Time.now();
    });
    token;
  };

  /// Returns whether the caller currently has an API token set (never returns the token).
  public query ({ caller }) func hasApiToken() : async Bool {
    if (caller.isAnonymous()) return false;
    switch (apiTokens.get(caller)) { case (?_) true; case null false };
  };

  /// Token-authenticated endpoint for the Chrome extension. Accepts a
  /// TradingView screenshot upload plus optional chart metadata and attaches
  /// it to a new draft trade or an existing trade selected by the payload.
  public shared func receiveExtensionCapture(capture : Types.ExtensionCapture) : async Types.CaptureResult {
    let tokenHash = TradingJournal.hashToken(capture.token);
    // Find the owning principal by matching the hashed token.
    let owner = switch (
      apiTokens.entries().toArray().find(
        func(entry : (Principal, Types.ApiToken)) : Bool {
          entry.1.tokenHash == tokenHash;
        },
      )
    ) {
      case (?entry) entry.0;
      case null Runtime.trap("Unauthorized: invalid or missing token");
    };
    let chartMetadata : ?Types.ChartMetadata = switch (capture.symbol, capture.timeframe, capture.price) {
      case (null, null, null) null;
      case _ ?{
        symbol = capture.symbol;
        timeframe = capture.timeframe;
        price = capture.price;
      };
    };
    // Attach to an existing trade if specified and owned by the token owner.
    // Any expanded capture fields (direction, entryPrice, exitPrice, size,
    // realizedPnl, outcomeNotes) merge into the existing trade — only non-null
    // provided values overwrite, so existing data is preserved.
    let tradeId = switch (capture.targetTradeId) {
      case (?tid) {
        switch (trades.get(tid)) {
          case (?t) {
            if (t.owner != owner) Runtime.trap("Unauthorized: trade not owned by token owner");
            let merged : Types.Trade = {
              t with
              direction = switch (capture.direction) {
                case (?d) d;
                case null t.direction;
              };
              entryPrice = switch (capture.entryPrice) {
                case (?v) v;
                case null t.entryPrice;
              };
              exitPrice = switch (capture.exitPrice) {
                case (?v) ?v;
                case null t.exitPrice;
              };
              positionSize = switch (capture.size) {
                case (?v) v;
                case null t.positionSize;
              };
              realizedPnl = switch (capture.realizedPnl) {
                case (?v) ?v;
                case null t.realizedPnl;
              };
              outcomeReasoning = switch (capture.outcomeNotes) {
                case (?v) ?v;
                case null t.outcomeReasoning;
              };
              // Backfill shareableUrl for trades created before this field
              // was populated at creation time.
              shareableUrl = switch (t.shareableUrl) {
                case (?u) ?u;
                case null ?shareableUrlFor(tid);
              };
              updatedAtNs = Time.now();
            };
            trades.add(tid, merged);
            tid;
          };
          case null Runtime.trap("Target trade not found");
        };
      };
      case null {
        // Create a new draft trade for this capture. Drafts bypass thesis
        // validation — the user finalizes (and validates) via createTrade or
        // updateTrade later. Expanded capture fields populate the draft with
        // sensible defaults when not provided by the extension.
        let now = Time.now();
        let newId = tradeState.nextTradeId;
        tradeState.nextTradeId := newId + 1;
        let symbol = switch (capture.symbol) { case (?s) s; case null "" };
        let direction : Types.Direction = switch (capture.direction) {
          case (?d) d;
          case null #long;
        };
        let entryPrice = switch (capture.entryPrice) {
          case (?v) v;
          case null 0.0;
        };
        let exitPrice : ?Float = switch (capture.exitPrice) {
          case (?v) ?v;
          case null null;
        };
        let positionSize = switch (capture.size) {
          case (?v) v;
          case null 0.0;
        };
        let realizedPnl : ?Float = switch (capture.realizedPnl) {
          case (?v) ?v;
          case null null;
        };
        let outcomeReasoning : ?Text = switch (capture.outcomeNotes) {
          case (?v) ?v;
          case null null;
        };
        let trade : Types.Trade = {
          id = newId;
          owner;
          symbol;
          direction;
          entryPrice;
          exitPrice;
          positionSize;
          entryAtNs = now;
          exitAtNs = null;
          holdTimeSecs = null;
          realizedPnl;
          preTradeThesis = { thesis = ""; counterReasons = [] };
          confidenceRating = 1;
          tradeOrigin = #selfGenerated;
          originSourceNote = null;
          preSessionEmotion = { state = #neutral; note = ""; capturedAtNs = now };
          duringTradeEmotion = null;
          outcomeReasoning;
          isDraft = true;
          shareableUrl = ?shareableUrlFor(newId);
          createdAtNs = now;
          updatedAtNs = now;
        };
        trades.add(newId, trade);
        newId;
      };
    };
    let mediaId = tradeState.nextMediaId;
    tradeState.nextMediaId := mediaId + 1;
    let record : Types.Media = {
      id = mediaId;
      tradeId;
      mediaType = capture.mediaType;
      storageKey = capture.mediaStorageKey;
      originalStorageKey = null;
      caption = capture.caption;
      uploadedAtNs = Time.now();
      source = #chromeExtension;
      chartMetadata;
    };
    let existing = switch (mediaByTrade.get(tradeId)) {
      case (?l) l;
      case null List.empty<Types.Media>();
    };
    existing.add(record);
    mediaByTrade.add(tradeId, existing);
    {
      tradeId;
      mediaId;
      wasDraftCreated = capture.targetTradeId == null;
    };
  };

  /// Daily analytics: today's trades with thesis completeness and confidence vs outcome.
  public query ({ caller }) func getDailySummary(dayStartNs : Int) : async [Types.DailyTradeSummary] {
    if (caller.isAnonymous()) return [];
    let dayEndNs = dayStartNs + 86_400_000_000_000; // +24h in nanoseconds
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= dayStartNs and t.entryAtNs < dayEndNs;
      },
    );
    owned.map(
      func(t : Types.Trade) : Types.DailyTradeSummary { TradingJournal.toDailySummary(t) },
    );
  };

  /// Weekly review: surfaces bias signatures across the caller's trades in the window.
  public query ({ caller }) func getWeeklySignatures(weekStartNs : Int, weekEndNs : Int) : async [Types.BiasSignature] {
    if (caller.isAnonymous()) return [];
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= weekStartNs and t.entryAtNs <= weekEndNs;
      },
    );
    TradingJournal.detectWeeklySignatures(owned);
  };

  /// Monthly analysis: hold-time comparison with loss-aversion flag.
  public query ({ caller }) func getMonthlyHoldTimeAnalysis(monthStartNs : Int, monthEndNs : Int) : async Types.HoldTimeAnalysis {
    if (caller.isAnonymous()) {
      return { avgWinnerHoldSecs = null; avgLoserHoldSecs = null; lossAversionFlag = false };
    };
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= monthStartNs and t.entryAtNs <= monthEndNs;
      },
    );
    TradingJournal.computeHoldTimeAnalysis(owned);
  };

  /// Monthly analysis: confidence-vs-outcome correlation exposing overconfidence.
  public query ({ caller }) func getMonthlyConfidenceOutcome(monthStartNs : Int, monthEndNs : Int) : async Types.ConfidenceOutcomeAnalysis {
    if (caller.isAnonymous()) {
      return { correlation = 0.0; overconfidenceFlag = false };
    };
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= monthStartNs and t.entryAtNs <= monthEndNs;
      },
    );
    TradingJournal.computeConfidenceOutcome(owned);
  };

  /// Monthly analysis: FOMO/regret tracking listing skipped trades and FOMO-tagged trades.
  public query ({ caller }) func getMonthlyFomoAnalysis(monthStartNs : Int, monthEndNs : Int) : async {
    skippedTrades : [Types.SkippedTrade];
    fomoTaggedTradeIds : [Nat];
    theoreticalPnlTotal : Float;
  } {
    if (caller.isAnonymous()) {
      return { skippedTrades = []; fomoTaggedTradeIds = []; theoreticalPnlTotal = 0.0 };
    };
    let skipped = skippedTrades.values().toArray().filter(
      func(s : Types.SkippedTrade) : Bool {
        s.owner == caller and s.skippedAtNs >= monthStartNs and s.skippedAtNs <= monthEndNs;
      },
    );
    let fomoTrades = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= monthStartNs and t.entryAtNs <= monthEndNs and t.tradeOrigin == #sociallyInfluenced;
      },
    );
    let fomoTaggedTradeIds = fomoTrades.map(
      func(t : Types.Trade) : Nat { t.id },
    );
    let theoreticalPnlTotal = skipped.foldLeft(
      0.0,
      func(acc : Float, s : Types.SkippedTrade) : Float {
        switch (s.theoreticalPnl) { case (?p) acc + p; case null acc };
      },
    );
    { skippedTrades = skipped; fomoTaggedTradeIds; theoreticalPnlTotal };
  };

  /// Monthly analysis: win rate and profit factor vs historical baseline with status-quo flag.
  public query ({ caller }) func getMonthlyStrategyBaseline(monthStartNs : Int, monthEndNs : Int) : async Types.StrategyBaselineAnalysis {
    if (caller.isAnonymous()) {
      return {
        winRate = 0.0;
        profitFactor = 0.0;
        historicalWinRate = null;
        historicalProfitFactor = null;
        statusQuoBiasFlag = false;
      };
    };
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and t.entryAtNs >= monthStartNs and t.entryAtNs <= monthEndNs;
      },
    );
    // Historical baseline = all the caller's trades outside the window.
    let historical = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool {
        t.owner == caller and (t.entryAtNs < monthStartNs or t.entryAtNs > monthEndNs);
      },
    );
    let baseline = TradingJournal.computeStrategyBaseline(historical, null, null);
    TradingJournal.computeStrategyBaseline(owned, ?baseline.winRate, ?baseline.profitFactor);
  };

  /// Self-assessment: categorize the last 20 trades by bias type and surface top offenders.
  public query ({ caller }) func getSelfAssessment() : async Types.SelfAssessment {
    if (caller.isAnonymous()) {
      return {
        categorizedTrades = [];
        topBiases = [];
        progressTo20 = 0;
        progressTo50 = 0;
      };
    };
    let owned = trades.values().toArray().filter(
      func(t : Types.Trade) : Bool { t.owner == caller },
    );
    let sorted = owned.sort(
      func(a : Types.Trade, b : Types.Trade) : { #less; #equal; #greater } {
        Int.compare(b.entryAtNs, a.entryAtNs); // most recent first
      },
    );
    let last20 = sorted.sliceToArray(0, Nat.min(sorted.size(), 20));
    TradingJournal.categorizeBiases(last20);
  };

  /// Targeted fix suggestions for the caller's top bias types.
  public query ({ caller }) func getTargetedFixes(biasTypes : [Types.BiasSignatureType]) : async [Types.TargetedFix] {
    if (caller.isAnonymous()) return [];
    biasTypes.map(
      func(b : Types.BiasSignatureType) : Types.TargetedFix { TradingJournal.targetedFixFor(b) },
    );
  };
};
