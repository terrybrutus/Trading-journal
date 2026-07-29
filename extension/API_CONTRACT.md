# Extension API Contract

The extension uses a browser bridge because Caffeine exports this app as a
single-page application. A path such as `/api/capture` can return the app HTML
shell instead of an HTTP API response.

The current working path is:

1. Extension stores the pending capture in `chrome.storage.local`.
2. Extension opens the Caffeine app URL.
3. `extension/caffeine_bridge.js` posts the capture into the page.
4. `ExtensionCaptureBridge.tsx` calls the Motoko actor method:

```motoko
receiveExtensionCapture(capture : ExtensionCapture)
```

## Request Body

The extension sends both friendly HTTP names and current backend-native names where they differ.

```json
{
  "token": "<api-token>",
  "source": "tradingview-chrome-extension",
  "capturedAt": "2026-07-29T21:30:00.000Z",
  "addedAt": "2026-07-29T21:31:10.000Z",
  "tradeOccurredAt": "2026-07-29T20:15:00.000Z",
  "tradeOccurredAtNs": "1785356100000000000",
  "bucket": "Backtest",
  "symbol": "USTEC",
  "ticker": "USTEC",
  "direction": "long",
  "entryPrice": 100.25,
  "exitPrice": 103.5,
  "size": 2,
  "positionSize": 2,
  "realizedPnl": 6.5,
  "realizedProfitLoss": 6.5,
  "outcomeNotes": "Reflection notes",
  "reflectionNotes": "Reflection notes",
  "transcript": "Optional spoken transcript",
  "mediaType": "screenshot",
  "mediaStorageKey": "data:image/png;base64,...",
  "screenshotDataUrl": "data:image/png;base64,...",
  "caption": "Backtest",
  "audioDataUrl": "data:audio/webm;base64,...",
  "audioMimeType": "audio/webm",
  "audioDurationSecs": 42,
  "metadata": {
    "bucket": "Backtest",
    "extensionVersion": "0.1.0"
  }
}
```

## Bridge Result

The app reports one of these results back through the bridge:

```json
{
  "ok": true,
  "tradeId": 123,
  "mediaId": 456,
  "wasDraftCreated": true
}
```

## Current App Gap

The backend has first-class trades and media, but no first-class bucket field yet. Until the backend model adds buckets, the extension sends `bucket` as metadata/caption and keeps it in local JSON exports.

