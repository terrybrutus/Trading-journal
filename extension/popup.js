const DEFAULT_ENDPOINT = "https://exciting-brown-rc2-draft.caffeine.xyz/api/capture";

const els = {
  endpoint: document.getElementById("endpoint"),
  token: document.getElementById("token"),
  saveConnection: document.getElementById("saveConnection"),
  symbol: document.getElementById("symbol"),
  timeframe: document.getElementById("timeframe"),
  price: document.getElementById("price"),
  direction: document.getElementById("direction"),
  tradeOccurredAt: document.getElementById("tradeOccurredAt"),
  entryPrice: document.getElementById("entryPrice"),
  exitPrice: document.getElementById("exitPrice"),
  size: document.getElementById("size"),
  realizedPnl: document.getElementById("realizedPnl"),
  bucket: document.getElementById("bucket"),
  notes: document.getElementById("notes"),
  transcript: document.getElementById("transcript"),
  canvas: document.getElementById("canvas"),
  color: document.getElementById("color"),
  width: document.getElementById("width"),
  undo: document.getElementById("undo"),
  capture: document.getElementById("capture"),
  autofill: document.getElementById("autofill"),
  send: document.getElementById("send"),
  exportJson: document.getElementById("exportJson"),
  record: document.getElementById("record"),
  stop: document.getElementById("stop"),
  speech: document.getElementById("speech"),
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
let recognition = null;

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
  const screenshotDataUrl = els.canvas.toDataURL("image/png");
  const tradeOccurredAt = fromLocalInput(els.tradeOccurredAt.value);
  const entryPrice = numberOrNull(els.entryPrice.value);
  const exitPrice = numberOrNull(els.exitPrice.value);
  const price = numberOrNull(els.price.value);
  const size = numberOrNull(els.size.value);
  const realizedPnl = numberOrNull(els.realizedPnl.value);
  const notes = els.notes.value.trim();
  const transcript = els.transcript.value.trim();

  return {
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
    outcomeNotes: [notes, transcript ? `Transcript:\n${transcript}` : ""].filter(Boolean).join("\n\n") || null,
    reflectionNotes: notes || null,
    transcript: transcript || null,
    mediaType: "screenshot",
    mediaStorageKey: screenshotDataUrl,
    screenshotDataUrl,
    caption: els.bucket.value.trim() || null,
    audioDataUrl: audioDataUrl || null,
    audioMimeType: audioMimeType || null,
    audioDurationSecs,
    metadata: {
      bucket: els.bucket.value.trim(),
      extensionVersion: "0.1.0"
    }
  };
}

async function saveConnection() {
  await chrome.storage.local.set({
    quantumCaptureEndpoint: els.endpoint.value.trim() || DEFAULT_ENDPOINT,
    quantumApiToken: els.token.value.trim()
  });
  setStatus("Connection saved.");
}

async function autofillFromActiveTradingViewTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/([^/]+\.)?tradingview\.com\//i.test(tab.url || "")) {
    setStatus("Open a TradingView tab, then click Auto-fill.");
    return;
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.title || "";
      const titleMatch = title.match(/^([A-Z0-9:_\-.]+)/i);
      const symbol = titleMatch ? titleMatch[1].replace(/^.*:/, "") : "";
      const price = title.match(/\b(\d+(?:\.\d+)?)\b/)?.[1] || "";
      const timeframe = [...document.querySelectorAll("button, [role=button], [data-name]")]
        .map((node) => node.textContent?.trim() || "")
        .find((text) => /^(1|3|5|15|30|45|60|120|180|240|1D|1W|1M|D|W|M)$/i.test(text)) || "";
      return { symbol, timeframe, price };
    }
  });

  const value = result?.result || {};
  if (value.symbol) els.symbol.value = value.symbol;
  if (value.timeframe) els.timeframe.value = value.timeframe;
  if (value.price) els.price.value = value.price;
  setStatus(value.symbol || value.timeframe || value.price ? "Auto-filled what TradingView exposed." : "TradingView did not expose symbol/timeframe in readable page text.");
}

async function loadConnection() {
  const result = await chrome.storage.local.get(["quantumCaptureEndpoint", "quantumApiToken"]);
  els.endpoint.value = result.quantumCaptureEndpoint || DEFAULT_ENDPOINT;
  els.token.value = result.quantumApiToken || "";
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, async (dataUrl) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }
    capture = { dataUrl, pageUrl: tab.url || "", capturedAt: new Date().toISOString(), symbol: "" };
    await setScreenshot(dataUrl);
    setStatus("Captured current tab.");
  });
}

async function sendToCaffeine() {
  const endpoint = els.endpoint.value.trim();
  const token = els.token.value.trim();
  if (!endpoint || !token) {
    setStatus("Add endpoint and API token first.");
    return;
  }

  await chrome.storage.local.set({
    quantumCaptureEndpoint: endpoint,
    quantumApiToken: token
  });
  setStatus("Sending to Caffeine...");
  els.send.disabled = true;
  const entry = currentEntry();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...entry, token }),
      signal: controller.signal
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      throw new Error(typeof body === "string" ? body.slice(0, 300) : body?.message || body?.error || `HTTP ${response.status}`);
    }

    await chrome.storage.local.set({
      quantumLastCapture: {
        ...entry,
        caffeineResult: body,
        syncedAt: new Date().toISOString()
      }
    });
    const tradeId = body?.tradeId || body?.entryId || body?.id;
    setStatus(tradeId ? `Sent to Caffeine. Draft ${tradeId}.` : `Sent to Caffeine. Response: ${JSON.stringify(body || { ok: true })}`);
  } finally {
    clearTimeout(timeout);
    els.send.disabled = false;
  }
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

function toggleSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Speech transcript is not supported in this browser.");
    return;
  }
  if (recognition) {
    recognition.stop();
    recognition = null;
    els.speech.textContent = "Start transcript";
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    const parts = [];
    for (let i = 0; i < event.results.length; i += 1) {
      parts.push(event.results[i][0].transcript);
    }
    els.transcript.value = parts.join(" ").trim();
  };
  recognition.onend = () => {
    recognition = null;
    els.speech.textContent = "Start transcript";
  };
  recognition.start();
  els.speech.textContent = "Stop transcript";
  setStatus("Listening for transcript...");
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
els.capture.addEventListener("click", captureCurrentTab);
els.autofill.addEventListener("click", () => autofillFromActiveTradingViewTab().catch((error) => setStatus(`Auto-fill failed: ${error.message}`)));
els.send.addEventListener("click", () => sendToCaffeine().catch((error) => setStatus(`Sync failed: ${error.message}`)));
els.exportJson.addEventListener("click", exportJson);
els.record.addEventListener("click", () => startRecording().catch((error) => setStatus(error.message)));
els.stop.addEventListener("click", stopRecording);
els.speech.addEventListener("click", toggleSpeech);

(async function init() {
  els.tradeOccurredAt.value = toLocalInput(new Date());
  await loadConnection();
  await loadPendingCapture();
})();
