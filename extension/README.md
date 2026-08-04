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
3. Copy the Caffeine app URL from Settings, usually:
   `https://exciting-brown-rc2-draft.caffeine.xyz`
4. Click the extension icon and paste the app URL and token.
5. Click `Save connection`.

## Capture Flow

1. Click the floating `Journal` button on TradingView, or click the extension icon and `Capture current tab`.
2. Confirm symbol, direction, prices, size, P/L, bucket, and notes.
3. Mark up the chart.
4. Optionally record audio for the capture.
5. Click `Send to Caffeine`.

The extension opens Caffeine, hands the capture to the signed-in app, and the app calls its own backend to create a draft. The extension keeps the last submitted capture in local extension storage as a recovery backup.

