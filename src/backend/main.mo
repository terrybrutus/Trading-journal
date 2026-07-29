import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";

import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";

import OQL "mo:caffeineai-oql";
import Expose "mo:caffeineai-oql/Expose";

import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";

import Types "types/trading-journal";
import TradingJournalApi "mixins/trading-journal-api";

actor {
  // Access control state — initialized via the migration chain under
  // --enhanced-migration (no inline initializer allowed).
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);

  // Object storage — provides _immutableObjectStorageCreateCertificate for the
  // storage gateway. Required for media uploads (screenshots, GIFs, videos).
  include MixinObjectStorage();

  // Trading journal domain stable state. Types only — initial values come from
  // the migration chain (src/backend/migrations/20260721_000000.mo).
  let trades : Map.Map<Nat, Types.Trade>;
  let mediaByTrade : Map.Map<Nat, List.List<Types.Media>>;
  let audioByTrade : Map.Map<Nat, List.List<Types.AudioRecap>>;
  let skippedTrades : Map.Map<Nat, Types.SkippedTrade>;
  let apiTokens : Map.Map<Principal, Types.ApiToken>;
  let tradeState : {
    var nextTradeId : Nat;
    var nextMediaId : Nat;
    var nextAudioId : Nat;
    var nextSkippedTradeId : Nat;
  };

  include TradingJournalApi(
    trades,
    mediaByTrade,
    audioByTrade,
    skippedTrades,
    apiTokens,
    tradeState
  );

  // OQL — Data Intelligence. Trades and skipped trades are per-user scoped;
  // the agent answers aggregate bias-detection questions over them.
  // Manual mode is required because Trade carries variants (Direction,
  // TradeOrigin, EmotionalState), nested records (PreTradeThesis,
  // EmotionalSnapshot), and optionals — none of which auto-derive. Each field
  // is declared explicitly via .payload (scalar / variant / optional) or
  // .flatten (nested record). Variants project to Text; optionals unwrap to a
  // sentinel so the schema type stays stable across rows.
  include Expose({
    entities = [
      trades
        .toEntityManual("trade", "Trade", "id")
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          symbol = "";
          direction = #long;
          entryPrice = 0.0;
          exitPrice = null;
          positionSize = 0.0;
          entryAtNs = 0;
          exitAtNs = null;
          holdTimeSecs = null;
          realizedPnl = null;
          preTradeThesis = { thesis = ""; counterReasons = [] };
          confidenceRating = 0;
          tradeOrigin = #selfGenerated;
          originSourceNote = null;
          preSessionEmotion = { state = #calm; note = ""; capturedAtNs = 0 };
          duringTradeEmotion = null;
          outcomeReasoning = null;
          isDraft = false;
          shareableUrl = null;
          createdAtNs = 0;
          updatedAtNs = 0;
        })
        .payload("id", func t = t.id)
        .payload("owner", func t = t.owner)
        .payload("symbol", func t = t.symbol)
        .payload("direction", func t = switch (t.direction) {
          case (#long) "long";
          case (#short) "short";
        })
        .payload("entryPrice", func t = t.entryPrice)
        .payload("exitPrice", func t = switch (t.exitPrice) {
          case null 0.0;
          case (?p) p;
        })
        .payload("positionSize", func t = t.positionSize)
        .payload("entryAtNs", func t = t.entryAtNs)
        .payload("exitAtNs", func t = switch (t.exitAtNs) {
          case null 0;
          case (?n) n;
        })
        .payload("holdTimeSecs", func t = switch (t.holdTimeSecs) {
          case null 0;
          case (?n) n;
        })
        .payload("realizedPnl", func t = switch (t.realizedPnl) {
          case null 0.0;
          case (?p) p;
        })
        .payload("preTradeThesis", func t = t.preTradeThesis.thesis)
        .payload("preTradeCounterReasonCount", func t = t.preTradeThesis.counterReasons.size())
        .payload("confidenceRating", func t = t.confidenceRating)
        .payload("tradeOrigin", func t = switch (t.tradeOrigin) {
          case (#selfGenerated) "selfGenerated";
          case (#sociallyInfluenced) "sociallyInfluenced";
        })
        .payload("originSourceNote", func t = switch (t.originSourceNote) {
          case null "";
          case (?n) n;
        })
        .payload("preSessionEmotionState", func t = switch (t.preSessionEmotion.state) {
          case (#calm) "calm";
          case (#anxious) "anxious";
          case (#euphoric) "euphoric";
          case (#fearful) "fearful";
          case (#greedy) "greedy";
          case (#neutral) "neutral";
        })
        .payload("preSessionEmotionNote", func t = t.preSessionEmotion.note)
        .payload("preSessionEmotionCapturedAtNs", func t = t.preSessionEmotion.capturedAtNs)
        .payload("duringTradeEmotionState", func t = switch (t.duringTradeEmotion) {
          case null "";
          case (?e) switch (e.state) {
            case (#calm) "calm";
            case (#anxious) "anxious";
            case (#euphoric) "euphoric";
            case (#fearful) "fearful";
            case (#greedy) "greedy";
            case (#neutral) "neutral";
          };
        })
        .payload("duringTradeEmotionNote", func t = switch (t.duringTradeEmotion) {
          case null "";
          case (?e) e.note;
        })
        .payload("duringTradeEmotionCapturedAtNs", func t = switch (t.duringTradeEmotion) {
          case null 0;
          case (?e) e.capturedAtNs;
        })
        .payload("outcomeReasoning", func t = switch (t.outcomeReasoning) {
          case null "";
          case (?r) r;
        })
        .payload("isDraft", func t = t.isDraft)
        .payload("shareableUrl", func t = switch (t.shareableUrl) {
          case null "";
          case (?u) u;
        })
        .payload("createdAtNs", func t = t.createdAtNs)
        .payload("updatedAtNs", func t = t.updatedAtNs)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
      skippedTrades
        .toEntityManual("skippedTrade", "SkippedTrade", "id")
        .sample({
          id = 0;
          owner = Principal.fromText("aaaaa-aa");
          symbol = "";
          note = "";
          fomoTagged = false;
          theoreticalPnl = null;
          skippedAtNs = 0;
        })
        .payload("id", func t = t.id)
        .payload("owner", func t = t.owner)
        .payload("symbol", func t = t.symbol)
        .payload("note", func t = t.note)
        .payload("fomoTagged", func t = t.fomoTagged)
        .payload("theoreticalPnl", func t = switch (t.theoreticalPnl) {
          case null 0.0;
          case (?p) p;
        })
        .payload("skippedAtNs", func t = t.skippedAtNs)
        .ownedBy("owner")
        .controllerOrScoped()
        .build(),
    ];
  });
};
