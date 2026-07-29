import Map "mo:core/Map";
import List "mo:core/List";

import AccessControl "mo:caffeineai-authorization/access-control";

module {
  /// Previous actor had only the access-control state slice (initialized inline
  /// via AccessControl.initState() outside the migration chain). The trading
  /// journal domain introduces new stable state for the first time.
  public type OldActor = {};

  /// New stable fields introduced by the trading-journal domain. Each field
  /// must match a stable binding declared in main.mo (same name, supertype).
  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    trades : Map.Map<Nat, TradeRow>;
    mediaByTrade : Map.Map<Nat, List.List<MediaRow>>;
    audioByTrade : Map.Map<Nat, List.List<AudioRow>>;
    skippedTrades : Map.Map<Nat, SkippedRow>;
    apiTokens : Map.Map<Principal, TokenRow>;
    tradeState : TradeState;
  };

  // Inlined row types — self-contained migration, no project imports.
  public type TradeRow = {
    id : Nat;
    owner : Principal;
    symbol : Text;
    direction : { #long; #short };
    entryPrice : Float;
    exitPrice : ?Float;
    positionSize : Float;
    entryAtNs : Int;
    exitAtNs : ?Int;
    holdTimeSecs : ?Nat;
    realizedPnl : ?Float;
    preTradeThesis : { bullThesis : Text; bearCaseReasons : [{ text : Text }] };
    confidenceRating : Nat;
    tradeOrigin : { #selfGenerated; #sociallyInfluenced };
    originSourceNote : ?Text;
    preSessionEmotion : { state : EmotionalState; note : Text; capturedAtNs : Int };
    duringTradeEmotion : ?{ state : EmotionalState; note : Text; capturedAtNs : Int };
    outcomeReasoning : ?Text;
    isDraft : Bool;
    createdAtNs : Int;
    updatedAtNs : Int;
  };

  public type MediaRow = {
    id : Nat;
    tradeId : Nat;
    mediaType : { #screenshot; #gif; #videoClip; #annotatedImage };
    storageKey : Text;
    originalStorageKey : ?Text;
    caption : ?Text;
    uploadedAtNs : Int;
    source : { #userUpload; #chromeExtension };
    chartMetadata : ?{ symbol : ?Text; timeframe : ?Text; price : ?Float };
  };

  public type AudioRow = {
    id : Nat;
    tradeId : Nat;
    audioStorageKey : Text;
    transcript : Text;
    recordedAtNs : Int;
    durationSecs : Nat;
  };

  public type SkippedRow = {
    id : Nat;
    owner : Principal;
    symbol : Text;
    note : Text;
    fomoTagged : Bool;
    theoreticalPnl : ?Float;
    skippedAtNs : Int;
  };

  public type TokenRow = {
    tokenHash : Text;
    createdAtNs : Int;
  };

  public type TradeState = {
    var nextTradeId : Nat;
    var nextMediaId : Nat;
    var nextAudioId : Nat;
    var nextSkippedTradeId : Nat;
  };

  public type EmotionalState = {
    #calm;
    #anxious;
    #euphoric;
    #fearful;
    #greedy;
    #neutral;
  };

  public func migration(_old : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      trades = Map.empty();
      mediaByTrade = Map.empty();
      audioByTrade = Map.empty();
      skippedTrades = Map.empty();
      apiTokens = Map.empty();
      tradeState = {
        var nextTradeId = 1;
        var nextMediaId = 1;
        var nextAudioId = 1;
        var nextSkippedTradeId = 1;
      };
    };
  };
};
