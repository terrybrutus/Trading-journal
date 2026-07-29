# QUANTUM TradingView Capture

Chrome Manifest V3 extension for the QUANTUM/Bias Journal Caffeine app.

## Install

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Choose `Load unpacked`.
5. Select this `extension` folder.
6. Open TradingView.

The same folder works on Windows and macOS.

## Connect

1. In QUANTUM, open `Settings`.
2. Generate or regenerate the Chrome extension API token.
3. Copy the endpoint from Settings, usually:
   `https://exciting-brown-rc2-draft.caffeine.xyz/api/capture`
4. Click the extension icon and paste the endpoint and token.
5. Click `Save connection`.

## Capture Flow

1. Click the floating `Journal` button on TradingView, or click the extension icon and `Capture current tab`.
2. Confirm symbol, direction, prices, size, P/L, bucket, and notes.
3. Mark up the chart.
4. Optionally record audio or use browser speech transcript.
5. Click `Send to Caffeine`.

The extension sends a draft capture to Caffeine and keeps the last submitted capture in local extension storage as a recovery backup.

