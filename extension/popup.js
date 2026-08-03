const DEFAULT_ENDPOINT = "https://exciting-brown-rc2-draft.caffeine.xyz";

const els = {
  endpoint: document.getElementById("endpoint"),
  token: document.getElementById("token"),
  saveConnection: document.getElementById("saveConnection"),
  clearPending: document.getElementById("clearPending"),
  floatingButtonEnabled: document.getElementById("floatingButtonEnabled"),
  floatingButtonPosition: document.getElementById("floatingButtonPosition"),
  brokerImportText: document.getElementById("brokerImportText"),
  brokerImportFile: document.getElementById("brokerImportFile"),
  fillFromBroker: document.getElementById("fillFromBroker"),
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
  transcript: document.getElementById("transcript"),
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

function cleanImportNumber(value) {
  const number = Number(String(value || "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseCsvRows(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}

function parseBrokerCsv(input) {
  const rows = parseCsvRows(input.trim());
  if (rows.length < 2) return [];
  const header = rows[0].map((name) => name.trim().toLowerCase());
  const indexFor = (name) => header.indexOf(name);
  return rows.slice(1).flatMap((row) => {
    const symbol = row[indexFor("symbol")]?.trim();
    const occurredAt = row[indexFor("time")]?.trim();
    const title = row[indexFor("title")]?.trim() || "";
    const text = row[indexFor("text")]?.trim() || "";
    const match = text.match(/\b(Buy|Sell)\s+([\d.]+)\s+at\s+([\d,]+(?:\.\d+)?)/i);
    if (!symbol || !occurredAt || !match || !/executed/i.test(title)) return [];
    const size = cleanImportNumber(match[2]);
    const price = cleanImportNumber(match[3]);
    if (!size || price === null) return [];
    return [{
      symbol,
      side: match[1].toLowerCase(),
      size,
      price,
      occurredAt,
      orderType: title.replace(/\s+on\s+.*$/i, "").replace(/\s+executed/i, "").trim()
    }];
  });
}

function parseBrokerText(input) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = [];
  for (let index = 0; index < lines.length; index += 1) {
    const symbol = lines[index];
    const side = lines[index + 1]?.toLowerCase();
    if (!/^[A-Z0-9._:-]+$/i.test(symbol) || (side !== "buy" && side !== "sell")) continue;
    const orderLine = lines[index + 2] || "";
    const numbers = orderLine.split(/\s+/).map(cleanImportNumber).filter((value) => value !== null);
    const size = numbers[0];
    if (!size) continue;
    let cursor = index + 3;
    const prices = [];
    while (cursor < lines.length) {
      const value = cleanImportNumber(lines[cursor]);
      if (value === null) break;
      prices.push(value);
      cursor += 1;
    }
    const status = lines[cursor]?.toLowerCase();
    const detail = lines[cursor + 1] || "";
    const detailParts = detail.split(/\t+/).map((part) => part.trim());
    const occurredAt = detailParts.find((part) => /^\d{4}-\d{2}-\d{2}/.test(part))?.trim();
    const linkedOrderId = detailParts.find((part) => /^[A-Z0-9._:-]+:\d+$/i.test(part));
    const orderId = detailParts.find((part) => /^\d{6,}$/.test(part));
    const numericDetail = detailParts
      .map((part) => ({ raw: part, value: cleanImportNumber(part) }))
      .filter((part) => part.value !== null && !/^\d{6,}$/.test(part.raw) && !/^\d{4}-\d{2}-\d{2}/.test(part.raw));
    const pnl = numericDetail.length > 1 ? numericDetail[numericDetail.length - 1].value : undefined;
    const price = prices[prices.length - 1];
    if (status !== "filled" || !occurredAt || price === undefined) continue;
    rows.push({ symbol, side, size, price, occurredAt, orderType: orderLine.replace(/[\d.\s]+/g, " ").trim(), linkedOrderId, orderId, pnl, source: "text" });
    index = cursor + 1;
  }
  return rows;
}

function directionForBrokerSide(side) {
  return side === "sell" ? "short" : "long";
}

function pairBrokerFills(fills) {
  const positions = new Map();
  const trades = [];
  const sorted = [...fills].sort(
    (a, b) => Date.parse(a.occurredAt.replace(" ", "T")) - Date.parse(b.occurredAt.replace(" ", "T"))
  );
  const used = new Set();
  for (const close of sorted) {
    const linkedOrderId = close.linkedOrderId?.split(":").pop();
    if (!linkedOrderId || linkedOrderId === close.orderId || close.pnl === undefined) continue;
    const entry = sorted.find((fill) =>
      !used.has(fill) &&
      fill !== close &&
      fill.symbol === close.symbol &&
      fill.orderId === linkedOrderId &&
      fill.side !== close.side &&
      Date.parse(fill.occurredAt.replace(" ", "T")) <= Date.parse(close.occurredAt.replace(" ", "T"))
    );
    if (!entry) continue;
    used.add(entry);
    used.add(close);
    trades.push({
      symbol: close.symbol,
      direction: directionForBrokerSide(entry.side),
      size: Math.min(entry.size, close.size),
      entryPrice: entry.price,
      exitPrice: close.price,
      realizedPnl: close.pnl,
      occurredAt: entry.occurredAt,
      closedAt: close.occurredAt,
      orderType: `${entry.orderType || "Entry"} -> ${close.orderType || "Exit"}`,
      status: "closed"
    });
  }
  if (sorted.some((fill) => fill.source === "text")) {
    for (const fill of sorted) {
      if (used.has(fill)) continue;
      const linkedOrderId = fill.linkedOrderId?.split(":").pop();
      if (fill.pnl !== undefined && linkedOrderId && linkedOrderId !== fill.orderId) continue;
      trades.push({
        symbol: fill.symbol,
        direction: directionForBrokerSide(fill.side),
        size: fill.size,
        entryPrice: fill.price,
        occurredAt: fill.occurredAt,
        orderType: fill.orderType,
        status: "open"
      });
    }
    return trades.sort(
      (a, b) => Date.parse((b.closedAt || b.occurredAt).replace(" ", "T")) - Date.parse((a.closedAt || a.occurredAt).replace(" ", "T"))
    );
  }
  for (const fill of sorted) {
    if (used.has(fill)) continue;
    const open = positions.get(fill.symbol);
    const direction = directionForBrokerSide(fill.side);
    if (!open || open.direction === direction) {
      const current = open || {
        symbol: fill.symbol,
        direction,
        remaining: 0,
        entryPrice: 0,
        openedAt: fill.occurredAt,
        orderType: fill.orderType
      };
      const nextRemaining = current.remaining + fill.size;
      current.entryPrice = nextRemaining === 0
        ? fill.price
        : ((current.entryPrice * current.remaining) + (fill.price * fill.size)) / nextRemaining;
      current.remaining = nextRemaining;
      positions.set(fill.symbol, current);
      continue;
    }
    const size = Math.min(open.remaining, fill.size);
    trades.push({
      symbol: fill.symbol,
      direction: open.direction,
      size,
      entryPrice: open.entryPrice,
      exitPrice: fill.price,
      realizedPnl: fill.pnl,
      occurredAt: open.openedAt,
      closedAt: fill.occurredAt,
      orderType: `${open.orderType || "Entry"} -> ${fill.orderType || "Exit"}`,
      status: "closed"
    });
    open.remaining -= size;
    if (open.remaining <= 0.0000001) positions.delete(fill.symbol);
  }
  for (const open of positions.values()) {
    trades.push({
      symbol: open.symbol,
      direction: open.direction,
      size: open.remaining,
      entryPrice: open.entryPrice,
      occurredAt: open.openedAt,
      orderType: open.orderType,
      status: "open"
    });
  }
  return trades.sort(
    (a, b) => Date.parse((b.closedAt || b.occurredAt).replace(" ", "T")) - Date.parse((a.closedAt || a.occurredAt).replace(" ", "T"))
  );
}

function applyBrokerExecution(row) {
  els.symbol.value = row.symbol || els.symbol.value;
  els.direction.value = row.direction || els.direction.value;
  els.entryPrice.value = row.entryPrice?.toString() || els.entryPrice.value;
  els.exitPrice.value = row.exitPrice?.toString() || els.exitPrice.value;
  els.size.value = row.size?.toString() || els.size.value;
  if (row.exitPrice || row.entryPrice) els.price.value = (row.exitPrice || row.entryPrice).toString();
  if (row.realizedPnl !== undefined) els.realizedPnl.value = row.realizedPnl.toFixed(2);
  if (row.occurredAt) {
    const parsed = new Date(row.occurredAt.includes("T") ? row.occurredAt : row.occurredAt.replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) els.tradeOccurredAt.value = toLocalInput(parsed);
  }
  const note = row.status === "closed"
    ? `Broker import: ${row.orderType || "Order"} ${row.direction} ${row.size} entry ${row.entryPrice} exit ${row.exitPrice}`
    : `Broker import: ${row.orderType || "Order"} ${row.direction} ${row.size} entry ${row.entryPrice}`;
  els.notes.value = [els.notes.value.trim(), note].filter(Boolean).join("\n\n");
}

function fillFromBrokerImport() {
  const text = els.brokerImportText.value.trim();
  const rows = pairBrokerFills([...parseBrokerCsv(text), ...parseBrokerText(text)]);
  if (rows.length === 0) {
    setStatus("No filled broker executions found in pasted text or CSV.");
    return;
  }
  applyBrokerExecution(rows[0]);
  setStatus(`Filled latest broker execution for ${rows[0].symbol}.`);
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
    captureId: capture?.captureId || crypto.randomUUID(),
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
els.clearPending.addEventListener("click", clearPendingCapture);
els.floatingButtonEnabled.addEventListener("change", saveButtonPrefs);
els.floatingButtonPosition.addEventListener("change", saveButtonPrefs);
els.brokerImportFile.addEventListener("change", async () => {
  const file = els.brokerImportFile.files?.[0];
  if (!file) return;
  els.brokerImportText.value = await file.text();
  fillFromBrokerImport();
});
els.fillFromBroker.addEventListener("click", fillFromBrokerImport);
els.capture.addEventListener("click", captureCurrentTab);
els.autofill.addEventListener("click", () => autofillFromTradingViewTab().catch((error) => setStatus(`Auto-fill failed: ${error.message}`)));
els.usePriceAsEntry.addEventListener("click", () => useChartPrice(els.entryPrice));
els.usePriceAsExit.addEventListener("click", () => useChartPrice(els.exitPrice));
els.calcPnl.addEventListener("click", calculatePnl);
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
