import Map "mo:core/Map";
import List "mo:core/List";

import AccessControl "mo:caffeineai-authorization/access-control";

module {
  /// Previous actor state shape (the NewActor of 20260721_000000.mo). The
  /// trading-journal domain's PreTradeThesis used direction-biased field names
  /// (bullThesis / bearCaseReasons) and Trade had no shareableUrl field.
  public type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    trades : Map.Map<Nat, OldTradeRow>;
    mediaByTrade : Map.Map<Nat, List.List<MediaRow>>;
    audioByTrade : Map.Map<Nat, List.List<AudioRow>>;
    skippedTrades : Map.Map<Nat, SkippedRow>;
    apiTokens : Map.Map<Principal, TokenRow>;
    tradeState : TradeState;
  };

  /// New actor state shape. PreTradeThesis fields are renamed to direction-neutral
  /// names (thesis / counterReasons) and Trade gains a shareableUrl field.
  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    trades : Map.Map<Nat, NewTradeRow>;
    mediaByTrade : Map.Map<Nat, List.List<MediaRow>>;
    audioByTrade : Map.Map<Nat, List.List<AudioRow>>;
    skippedTrades : Map.Map<Nat, SkippedRow>;
    apiTokens : Map.Map<Principal, TokenRow>;
    tradeState : TradeState;
  };

  public type OldTradeRow = {
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

  public type NewTradeRow = {
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
    preTradeThesis : { thesis : Text; counterReasons : [{ text : Text }] };
    confidenceRating : Nat;
    tradeOrigin : { #selfGenerated; #sociallyInfluenced };
    originSourceNote : ?Text;
    preSessionEmotion : { state : EmotionalState; note : Text; capturedAtNs : Int };
    duringTradeEmotion : ?{ state : EmotionalState; note : Text; capturedAtNs : Int };
    outcomeReasoning : ?Text;
    isDraft : Bool;
    shareableUrl : ?Text;
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

  /// Rename PreTradeThesis fields (bullThesis -> thesis, bearCaseReasons ->
  /// counterReasons) and add shareableUrl = null to every existing trade.
  /// All other state is carried over unchanged.
  public func migration(old : OldActor) : NewActor {
    let newTrades = old.trades.map<Nat, OldTradeRow, NewTradeRow>(
      func(_id, t) {
        {
          id = t.id;
          owner = t.owner;
          symbol = t.symbol;
          direction = t.direction;
          entryPrice = t.entryPrice;
          exitPrice = t.exitPrice;
          positionSize = t.positionSize;
          entryAtNs = t.entryAtNs;
          exitAtNs = t.exitAtNs;
          holdTimeSecs = t.holdTimeSecs;
          realizedPnl = t.realizedPnl;
          preTradeThesis = {
            thesis = t.preTradeThesis.bullThesis;
            counterReasons = t.preTradeThesis.bearCaseReasons;
          };
          confidenceRating = t.confidenceRating;
          tradeOrigin = t.tradeOrigin;
          originSourceNote = t.originSourceNote;
          preSessionEmotion = t.preSessionEmotion;
          duringTradeEmotion = t.duringTradeEmotion;
          outcomeReasoning = t.outcomeReasoning;
          isDraft = t.isDraft;
          shareableUrl = null;
          createdAtNs = t.createdAtNs;
          updatedAtNs = t.updatedAtNs;
        };
      },
    );
    {
      accessControlState = old.accessControlState;
      trades = newTrades;
      mediaByTrade = old.mediaByTrade;
      audioByTrade = old.audioByTrade;
      skippedTrades = old.skippedTrades;
      apiTokens = old.apiTokens;
      tradeState = old.tradeState;
    };
  };
};
