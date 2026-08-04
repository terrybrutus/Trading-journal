const DEFAULT_ENDPOINT = "https://exciting-brown-rc2-draft.caffeine.xyz";

const els = {
  endpoint: document.getElementById("endpoint"),
  token: document.getElementById("token"),
  saveConnection: document.getElementById("saveConnection"),
  clearPending: document.getElementById("clearPending"),
  floatingButtonEnabled: document.getElementById("floatingButtonEnabled"),
  floatingButtonPosition: document.getElementById("floatingButtonPosition"),
  symbol: document.getElementById("symbol"),
  timeframe: document.getElementById("timeframe"),
  price: document.getElementById("price"),
  direction: document.getElementById("direction"),
  tradeOccurredAt: document.getElementById("tradeOccurredAt"),
  entryPrice: document.getElementById("entryPrice"),
  usePriceAsEntry: document.getElementById("usePriceAsEntry"),
  exitPrice: document.getElementById("exitPrice"),
  usePriceAsExit: document.getElementById("usePriceAsExit"),
  size: document.getElementById("size"),
  realizedPnl: document.getElementById("realizedPnl"),
  bucket: document.getElementById("bucket"),
  notes: document.getElementById("notes"),
  canvas: document.getElementById("canvas"),
  color: document.getElementById("color"),
  width: document.getElementById("width"),
  undo: document.getElementById("undo"),
  capture: document.getElementById("capture"),
  autofill: document.getElementById("autofill"),
  calcPnl: document.getElementById("calcPnl"),
  send: document.getElementById("send"),
  exportJson: document.getElementById("exportJson"),
  record: document.getElementById("record"),
  stop: document.getElementById("stop"),
  audio: document.getElementById("audio"),
  status: document.getElementById("status")
};

const ctx = els.canvas.getContext("2d");
let capture = null;
let audioDataUrl = "";
let audioMimeType = "";
let audioDurationSecs = 0;
let mediaRecorder = null;
let chunks = [];
let recordStartedAt = 0;
let tool = "pen";
let drawing = false;
let start = null;
let last = null;
let history = [];

function setStatus(message) {
  els.status.textContent = message;
  clearTimeout(setStatus.timer);
  if (!/failed|error|HTTP|denied|blocked|Sent/i.test(message)) {
    setStatus.timer = setTimeout(() => {
      els.status.textContent = "";
    }, 4200);
  }
}

function toLocalInput(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function nsFromIso(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : String(BigInt(ms) * 1000000n);
}

function numberOrNull(value) {
  const cleaned = String(value || "").replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function option(value) {
  return value === null || value === undefined || value === "" ? null : value;
}

function drawBlank() {
  els.canvas.width = 1280;
  els.canvas.height = 720;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.fillStyle = "#64748b";
  ctx.font = "24px system-ui";
  ctx.fillText("Capture TradingView or paste a screenshot here.", 48, 80);
  pushHistory();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function setScreenshot(dataUrl) {
  if (!dataUrl) {
    drawBlank();
    return;
  }
  const img = await loadImage(dataUrl);
  els.canvas.width = img.naturalWidth || img.width;
  els.canvas.height = img.naturalHeight || img.height;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(img, 0, 0, els.canvas.width, els.canvas.height);
  history = [els.canvas.toDataURL("image/png")];
}

function pushHistory() {
  history.push(els.canvas.toDataURL("image/png"));
  if (history.length > 20) history.shift();
}

function restore(dataUrl) {
  loadImage(dataUrl).then((img) => {
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    ctx.drawImage(img, 0, 0, els.canvas.width, els.canvas.height);
  });
}

function point(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (els.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.canvas.height / rect.height)
  };
}

function strokeStyle(activeTool = tool) {
  ctx.lineWidth = Number(els.width.value);
  ctx.strokeStyle = els.color.value;
  ctx.fillStyle = els.color.value;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = activeTool === "highlighter" ? 0.35 : 1;
}

function onPointerDown(event) {
  event.preventDefault();
  drawing = true;
  start = point(event);
  last = start;
  if (tool === "text") {
    const text = prompt("Text label");
    if (text) {
      strokeStyle("text");
      ctx.font = `${Math.max(18, Number(els.width.value) * 5)}px system-ui`;
      ctx.fillText(text, start.x, start.y);
      ctx.globalAlpha = 1;
      pushHistory();
    }
    drawing = false;
  }
}

function onPointerMove(event) {
  if (!drawing || tool === "text") return;
  event.preventDefault();
  const next = point(event);
  if (tool === "pen" || tool === "highlighter") {
    strokeStyle();
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    last = next;
  }
}

function onPointerUp(event) {
  if (!drawing || tool === "text") return;
  event.preventDefault();
  const end = point(event);
  if (tool === "box") {
    strokeStyle();
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    ctx.globalAlpha = 1;
  }
  drawing = false;
  pushHistory();
}

function currentEntry() {
  const captureId = capture?.captureId || crypto.randomUUID();
  const screenshotDataUrl = els.canvas.toDataURL("image/png");
  const tradeOccurredAt = fromLocalInput(els.tradeOccurredAt.value);
  const entryPrice = numberOrNull(els.entryPrice.value);
  const exitPrice = numberOrNull(els.exitPrice.value);
  const price = numberOrNull(els.price.value);
  const size = numberOrNull(els.size.value);
  const realizedPnl = numberOrNull(els.realizedPnl.value);
  const notes = els.notes.value.trim();

  return {
    captureId,
    caseId: captureId,
    exportedAt: new Date().toISOString(),
    source: "tradingview-chrome-extension",
    pageUrl: capture?.pageUrl || "",
    capturedAt: capture?.capturedAt || new Date().toISOString(),
    addedAt: new Date().toISOString(),
    tradeOccurredAt,
    tradeOccurredAtNs: nsFromIso(tradeOccurredAt),
    bucket: els.bucket.value.trim(),
    symbol: els.symbol.value.trim(),
    ticker: els.symbol.value.trim(),
    timeframe: els.timeframe.value.trim() || null,
    price,
    direction: els.direction.value || null,
    entryPrice,
    exitPrice,
    size,
    positionSize: size,
    realizedPnl,
    realizedProfitLoss: realizedPnl,
    outcomeNotes: notes || null,
    reflectionNotes: notes || null,
    transcript: null,
    mediaType: "screenshot",
    mediaStorageKey: screenshotDataUrl,
    screenshotDataUrl,
    caption: els.bucket.value.trim() || null,
    audioDataUrl: audioDataUrl || null,
    audioMimeType: audioMimeType || null,
    audioDurationSecs,
    metadata: {
      bucket: els.bucket.value.trim(),
      caseId: captureId,
      extensionVersion: "0.1.0"
    }
  };
}

async function saveConnection() {
  await chrome.storage.local.set({
    quantumCaptureEndpoint: normalizeCaffeineUrl(els.endpoint.value.trim() || DEFAULT_ENDPOINT),
    quantumApiToken: els.token.value.trim()
  });
  setStatus("Connection saved.");
}

async function clearPendingCapture() {
  await chrome.storage.local.remove([
    "quantumPendingCapture",
    "quantumPendingCaffeineCapture",
    "quantumLastCaffeineResult"
  ]);
  setStatus("Cleared pending extension captures.");
}

async function saveButtonPrefs() {
  await chrome.storage.local.set({
    quantumFloatingButtonEnabled: els.floatingButtonEnabled.checked,
    quantumFloatingButtonPosition: els.floatingButtonPosition.value
  });
  setStatus("TradingView button preference saved.");
}

function normalizeCaffeineUrl(value) {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

function isTradingViewUrl(url = "") {
  return /^https:\/\/([^/]+\.)?tradingview\.com\//i.test(url);
}

async function findTradingViewTab() {
  const tabs = await chrome.tabs.query({});
  const active = tabs.find((tab) => tab.active && isTradingViewUrl(tab.url || ""));
  if (active) return active;
  const candidates = tabs.filter((tab) => isTradingViewUrl(tab.url || ""));
  return candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
}

async function readTradingViewContext(tab) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.title || "";
      const titleMatch = title.match(/^([A-Z0-9:_\-.]+)/i);
      const symbol = titleMatch ? titleMatch[1].replace(/^.*:/, "") : "";
      const parsePrice = (text) => {
        const matches = String(text || "").match(/\$?-?\d{1,6}(?:,\d{3})+(?:\.\d+)?|\$?-?\d+\.\d{2,}/g) || [];
        return matches
          .map((raw) => ({
            raw,
            normalized: raw.replace(/[$,\s]/g, ""),
            value: Number(raw.replace(/[$,\s]/g, ""))
          }))
          .filter((item) => Number.isFinite(item.value) && Math.abs(item.value) > 0);
      };
      const nodes = [...document.querySelectorAll("[class*=price], [data-name*=price], [data-field*=price], [data-symbol], [data-name], span, div")]
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
        .filter(Boolean)
        .slice(0, 500);
      const symbolRows = symbol
        ? nodes.filter((text) => text.toUpperCase().includes(symbol.toUpperCase()))
        : [];
      const symbolPrices = symbolRows.flatMap(parsePrice);
      const allPrices = nodes.flatMap(parsePrice);
      const preferred =
        symbolPrices.find((item) => item.raw.includes(",")) ||
        symbolPrices[0] ||
        allPrices.find((item) => item.raw.includes(",")) ||
        allPrices[0];
      const price = preferred?.normalized || "";
      const timeframe = [...document.querySelectorAll("button, [role=button], [data-name]")]
        .map((node) => node.textContent?.trim() || "")
        .find((text) => /^(1|3|5|15|30|45|60|120|180|240|1D|1W|1M|D|W|M)$/i.test(text)) || "";
      return { symbol, timeframe, price };
    }
  });

  return result?.result || {};
}

async function autofillFromTradingViewTab() {
  const tab = await findTradingViewTab();
  if (!tab?.id) {
    setStatus("Open a TradingView tab, then click Auto-fill.");
    return;
  }

  const value = await readTradingViewContext(tab);
  capture = { ...(capture || {}), pageUrl: tab.url || capture?.pageUrl || "" };
  applyTradingViewContext(value);
  setStatus(value.symbol || value.timeframe || value.price ? "Auto-filled from your TradingView tab." : "TradingView did not expose symbol/timeframe/price in readable page text.");
}

function applyTradingViewContext(value = {}) {
  if (value.symbol) els.symbol.value = value.symbol;
  if (value.timeframe) els.timeframe.value = value.timeframe;
  if (value.price) els.price.value = value.price;
}

async function loadConnection() {
  const result = await chrome.storage.local.get([
    "quantumCaptureEndpoint",
    "quantumApiToken",
    "quantumFloatingButtonEnabled",
    "quantumFloatingButtonPosition"
  ]);
  els.endpoint.value = normalizeCaffeineUrl(result.quantumCaptureEndpoint || DEFAULT_ENDPOINT);
  els.token.value = result.quantumApiToken || "";
  els.floatingButtonEnabled.checked = result.quantumFloatingButtonEnabled !== false;
  els.floatingButtonPosition.value = result.quantumFloatingButtonPosition || "bottom-right";
}

async function loadPendingCapture() {
  const result = await chrome.storage.local.get("quantumPendingCapture");
  capture = result.quantumPendingCapture || null;
  if (capture) {
    els.symbol.value = capture.symbol || "";
    els.timeframe.value = capture.timeframe || "";
    els.price.value = capture.price || "";
    await setScreenshot(capture.dataUrl);
    await chrome.storage.local.remove("quantumPendingCapture");
    setStatus("TradingView capture loaded.");
  } else {
    drawBlank();
  }
}

async function captureCurrentTab() {
  const tradingViewTab = await findTradingViewTab();
  if (!tradingViewTab?.id || !tradingViewTab.windowId) {
    setStatus("Open a TradingView tab first, then click Capture TradingView tab.");
    return;
  }
  const [editorTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatus("Switching to TradingView for capture...");
  await chrome.tabs.update(tradingViewTab.id, { active: true });
  await chrome.windows.update(tradingViewTab.windowId, { focused: true });
  await new Promise((resolve) => setTimeout(resolve, 350));
  chrome.tabs.captureVisibleTab(tradingViewTab.windowId, { format: "png" }, async (dataUrl) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }
    const context = await readTradingViewContext(tradingViewTab).catch(() => ({}));
    capture = { captureId: crypto.randomUUID(), dataUrl, pageUrl: tradingViewTab.url || "", capturedAt: new Date().toISOString(), ...context };
    applyTradingViewContext(context);
    await setScreenshot(dataUrl);
    if (editorTab?.id) {
      await chrome.tabs.update(editorTab.id, { active: true }).catch(() => {});
    }
    setStatus("Captured TradingView tab.");
  });
}

async function sendToCaffeine() {
  const endpoint = normalizeCaffeineUrl(els.endpoint.value.trim());
  const token = els.token.value.trim();
  if (!endpoint || !token) {
    setStatus("Add Caffeine app URL and API token first.");
    return;
  }

  await chrome.storage.local.set({
    quantumCaptureEndpoint: endpoint,
    quantumApiToken: token
  });
  setStatus("Opening Caffeine to import capture...");
  els.send.disabled = true;
  const deliveryId = crypto.randomUUID();
  const entry = {
    ...currentEntry(),
    deliveryId,
    createdAtMs: Date.now(),
    expiresAtMs: Date.now() + 120000
  };
  try {
    await chrome.storage.local.set({
      quantumPendingCaffeineCapture: {
        ...entry,
        token
      },
      quantumLastCaffeineResult: null
    });
    await chrome.tabs.create({ url: `${endpoint}/journal?quantumCapture=pending&quantumDelivery=${deliveryId}` });
    pollCaffeineResult();
    setStatus("Caffeine opened. If you are signed in, the app will create the draft.");
  } finally {
    els.send.disabled = false;
  }
}

async function pollCaffeineResult() {
  const started = Date.now();
  const timer = setInterval(async () => {
    const result = await chrome.storage.local.get("quantumLastCaffeineResult");
    const value = result.quantumLastCaffeineResult;
    if (value?.receivedAt && Date.now() - Date.parse(value.receivedAt) < 30000) {
      clearInterval(timer);
      if (value.ok) {
        setStatus(`Caffeine imported draft trade ${value.tradeId}.`);
      } else {
        setStatus(`Caffeine import failed: ${value.error || "unknown error"}`);
      }
      return;
    }
    if (Date.now() - started > 30000) {
      clearInterval(timer);
      setStatus("Still waiting for Caffeine. Make sure the app tab is signed in and refreshed.");
    }
  }, 1000);
}

function useChartPrice(target) {
  const price = els.price.value.trim();
  if (!price) {
    setStatus("No chart price available. Click Auto-fill from TradingView first.");
    return;
  }
  target.value = price;
}

function calculatePnl() {
  const entry = numberOrNull(els.entryPrice.value);
  const exit = numberOrNull(els.exitPrice.value);
  const size = numberOrNull(els.size.value) || 1;
  const direction = els.direction.value;
  if (entry === null || exit === null || !direction) {
    setStatus("Choose direction and enter entry/exit to calculate P/L.");
    return;
  }
  const pnl = direction === "short" ? (entry - exit) * size : (exit - entry) * size;
  els.realizedPnl.value = pnl.toFixed(2);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(currentEntry(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `quantum-tradingview-capture-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((error) => {
    throw new Error(`${error.message}. In Chrome, open chrome://extensions, select QUANTUM Capture details, and allow microphone access.`);
  });
  chunks = [];
  recordStartedAt = Date.now();
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
    audioMimeType = blob.type;
    audioDurationSecs = Math.round((Date.now() - recordStartedAt) / 1000);
    const reader = new FileReader();
    reader.onload = () => {
      audioDataUrl = reader.result;
      els.audio.src = audioDataUrl;
      setStatus("Audio attached to this capture.");
    };
    reader.readAsDataURL(blob);
    stream.getTracks().forEach((track) => track.stop());
  };
  mediaRecorder.start();
  els.record.disabled = true;
  els.stop.disabled = false;
  setStatus("Recording audio...");
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  els.record.disabled = false;
  els.stop.disabled = true;
}

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    tool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach((item) => item.classList.toggle("active", item === button));
  });
});

els.canvas.addEventListener("pointerdown", onPointerDown);
els.canvas.addEventListener("pointermove", onPointerMove);
els.canvas.addEventListener("pointerup", onPointerUp);
els.canvas.addEventListener("pointerleave", onPointerUp);
els.undo.addEventListener("click", () => {
  if (history.length <= 1) return;
  history.pop();
  restore(history[history.length - 1]);
});
els.saveConnection.addEventListener("click", saveConnection);
els.clearPending.addEventListener("click", clearPendingCapture);
els.floatingButtonEnabled.addEventListener("change", saveButtonPrefs);
els.floatingButtonPosition.addEventListener("change", saveButtonPrefs);
els.capture.addEventListener("click", captureCurrentTab);
els.autofill.addEventListener("click", () => autofillFromTradingViewTab().catch((error) => setStatus(`Auto-fill failed: ${error.message}`)));
els.usePriceAsEntry.addEventListener("click", () => useChartPrice(els.entryPrice));
els.usePriceAsExit.addEventListener("click", () => useChartPrice(els.exitPrice));
els.calcPnl.addEventListener("click", calculatePnl);
els.send.addEventListener("click", () => sendToCaffeine().catch((error) => setStatus(`Sync failed: ${error.message}`)));
els.exportJson.addEventListener("click", exportJson);
els.record.addEventListener("click", () => startRecording().catch((error) => setStatus(error.message)));
els.stop.addEventListener("click", stopRecording);

(async function init() {
  els.tradeOccurredAt.value = toLocalInput(new Date());
  await loadConnection();
  await loadPendingCapture();
})();
