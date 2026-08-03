import { Direction } from "@/types";

export type ImportedTradeRow = {
  id: string;
  symbol: string;
  direction: Direction;
  entryOrderType: string;
  exitOrderType?: string;
  size: number;
  entryPrice: number;
  exitPrice?: number;
  status: string;
  occurredAt: string;
  closedAt?: string;
  entryOrderId?: string;
  exitOrderId?: string;
  pnl?: number;
  raw: string;
  source: "csv" | "text";
};

type ImportedFill = {
  symbol: string;
  side: "buy" | "sell";
  orderType: string;
  size: number;
  price: number;
  status: string;
  occurredAt: string;
  orderId?: string;
  linkedOrderId?: string;
  pnl?: number;
  raw: string;
  source: "csv" | "text";
};

function cleanNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function directionFor(side: string): Direction {
  return side.toLowerCase() === "sell" ? Direction.short_ : Direction.long_;
}

function makeId(parts: Array<string | number | undefined>) {
  return parts.filter((part) => part !== undefined && `${part}`.length > 0).join("|");
}

export function parseBrokerImport(input: string, source: "csv" | "text") {
  return source === "csv" ? parseCsvNotifications(input) : parsePastedTradingPanel(input);
}

export function parseCsvNotifications(input: string): ImportedTradeRow[] {
  const rows = parseCsv(input.trim());
  if (rows.length < 2) return [];
  const [header, ...body] = rows;
  const indexes = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));

  const fills = body.flatMap((row): ImportedFill[] => {
    const symbol = row[indexes.get("symbol") ?? -1]?.trim();
    const occurredAt = row[indexes.get("time") ?? -1]?.trim();
    const title = row[indexes.get("title") ?? -1]?.trim() ?? "";
    const text = row[indexes.get("text") ?? -1]?.trim() ?? "";
    const match = text.match(/\b(Buy|Sell)\s+([\d.]+)\s+at\s+([\d,]+(?:\.\d+)?)/i);
    const orderId = title.match(/\((\d+)\)/)?.[1];
    if (!symbol || !occurredAt || !match || !/executed/i.test(title)) return [];

    const side = match[1].toLowerCase() as "buy" | "sell";
    const size = cleanNumber(match[2]);
    const price = cleanNumber(match[3]);
    if (!size || price === undefined) return [];

    return [{
      symbol,
      side,
      orderType: title.replace(/\s+on\s+.*$/i, "").replace(/\s+executed/i, "").trim() || "Order",
      size,
      price,
      status: "filled",
      occurredAt,
      orderId,
      raw: [title, text].join(" - "),
      source: "csv",
    }];
  });

  return fillsToTrades(fills);
}

export function parsePastedTradingPanel(input: string): ImportedTradeRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fills: ImportedFill[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const symbol = lines[index];
    const side = lines[index + 1]?.toLowerCase();
    if (!/^[A-Z0-9._:-]+$/i.test(symbol) || (side !== "buy" && side !== "sell")) {
      continue;
    }

    const orderLine = lines[index + 2] ?? "";
    const orderParts = orderLine.split(/\s+/);
    const numericParts = orderParts
      .map((part) => cleanNumber(part))
      .filter((value): value is number => value !== undefined);
    const orderType = orderLine.replace(/[\d.\s]+/g, " ").trim() || "Order";
    const size = numericParts[0];
    const filledSize = numericParts[1];
    if (!size) continue;

    let cursor = index + 3;
    const prices: number[] = [];
    while (cursor < lines.length) {
      const value = cleanNumber(lines[cursor]);
      if (value === undefined) break;
      prices.push(value);
      cursor += 1;
    }

    const status = lines[cursor]?.toLowerCase() ?? "";
    const detail = lines[cursor + 1] ?? "";
    const detailParts = detail.split(/\t+/).map((part) => part.trim());
    const occurredAt = detailParts.find((part) => /^\d{4}-\d{2}-\d{2}/.test(part)) ?? "";
    const linkedOrderId = detailParts.find((part) => /^[A-Z0-9._:-]+:\d+$/i.test(part));
    const orderId = detailParts.find((part) => /^\d{6,}$/.test(part));
    const pnl = pnlFromDetailParts(detailParts);
    const price = prices.at(-1);

    if (!occurredAt || price === undefined || status !== "filled") continue;

    fills.push({
      symbol,
      side,
      orderType,
      size,
      price,
      status,
      occurredAt,
      orderId,
      linkedOrderId,
      pnl,
      raw: lines.slice(index, Math.min(cursor + 2, lines.length)).join("\n"),
      source: "text",
    });
    index = cursor + 1;
  }

  return fillsToTrades(fills);
}

function pnlFromDetailParts(parts: string[]): number | undefined {
  const numeric = parts
    .map((part) => ({ raw: part, value: cleanNumber(part) }))
    .filter((part): part is { raw: string; value: number } => part.value !== undefined);
  const withoutIds = numeric.filter(
    (part) => !/^\d{6,}$/.test(part.raw) && !/^\d{4}-\d{2}-\d{2}/.test(part.raw),
  );
  if (withoutIds.length <= 1) return undefined;
  return withoutIds.at(-1)?.value;
}

function fillsToTrades(fills: ImportedFill[]): ImportedTradeRow[] {
  type Position = {
    symbol: string;
    direction: Direction;
    remaining: number;
    entryPrice: number;
    openedAt: string;
    orderType: string;
    orderId?: string;
    raw: string[];
    source: "csv" | "text";
  };

  const positions = new Map<string, Position>();
  const trades: ImportedTradeRow[] = [];
  const sorted = [...fills]
    .filter((fill) => fill.status === "filled")
    .sort((a, b) => Date.parse(a.occurredAt.replace(" ", "T")) - Date.parse(b.occurredAt.replace(" ", "T")));
  const used = new Set<ImportedFill>();

  for (const close of sorted) {
    const linkedOrderId = close.linkedOrderId?.split(":").pop();
    if (!linkedOrderId || linkedOrderId === close.orderId || close.pnl === undefined) {
      continue;
    }
    const entry = sorted.find(
      (fill) =>
        !used.has(fill) &&
        fill !== close &&
        fill.symbol === close.symbol &&
        fill.orderId === linkedOrderId &&
        fill.side !== close.side &&
        Date.parse(fill.occurredAt.replace(" ", "T")) <=
          Date.parse(close.occurredAt.replace(" ", "T")),
    );
    if (!entry) continue;
    used.add(entry);
    used.add(close);
    trades.push({
      id: makeId([close.symbol, entry.occurredAt, close.occurredAt, entry.orderId, close.orderId, entry.size]),
      symbol: close.symbol,
      direction: directionFor(entry.side),
      entryOrderType: entry.orderType,
      exitOrderType: close.orderType,
      size: Math.min(entry.size, close.size),
      entryPrice: entry.price,
      exitPrice: close.price,
      status: "closed",
      occurredAt: entry.occurredAt,
      closedAt: close.occurredAt,
      entryOrderId: entry.orderId,
      exitOrderId: close.orderId,
      pnl: close.pnl,
      raw: [entry.raw, close.raw].join("\n\n"),
      source: entry.source,
    });
  }

  if (sorted.some((fill) => fill.source === "text")) {
    for (const fill of sorted) {
      if (used.has(fill)) continue;
      const linkedOrderId = fill.linkedOrderId?.split(":").pop();
      if (fill.pnl !== undefined && linkedOrderId && linkedOrderId !== fill.orderId) {
        continue;
      }
      trades.push({
        id: makeId([fill.symbol, fill.occurredAt, fill.orderId, fill.side, fill.size]),
        symbol: fill.symbol,
        direction: directionFor(fill.side),
        entryOrderType: fill.orderType,
        size: fill.size,
        entryPrice: fill.price,
        status: "open",
        occurredAt: fill.occurredAt,
        entryOrderId: fill.orderId,
        raw: fill.raw,
        source: fill.source,
      });
    }
    return trades.sort(
      (a, b) =>
        Date.parse((b.closedAt ?? b.occurredAt).replace(" ", "T")) -
        Date.parse((a.closedAt ?? a.occurredAt).replace(" ", "T")),
    );
  }

  for (const fill of sorted) {
    if (used.has(fill)) continue;
    const open = positions.get(fill.symbol);
    const fillDirection = directionFor(fill.side);
    if (!open || open.direction === fillDirection) {
      const current = open ?? {
        symbol: fill.symbol,
        direction: fillDirection,
        remaining: 0,
        entryPrice: 0,
        openedAt: fill.occurredAt,
        orderType: fill.orderType,
        orderId: fill.orderId,
        raw: [],
        source: fill.source,
      };
      const nextRemaining = current.remaining + fill.size;
      current.entryPrice =
        nextRemaining === 0
          ? fill.price
          : (current.entryPrice * current.remaining + fill.price * fill.size) /
            nextRemaining;
      current.remaining = nextRemaining;
      current.raw.push(fill.raw);
      positions.set(fill.symbol, current);
      continue;
    }

    const closeSize = Math.min(open.remaining, fill.size);
    trades.push({
      id: makeId([fill.symbol, open.openedAt, fill.occurredAt, open.orderId, fill.orderId, closeSize]),
      symbol: fill.symbol,
      direction: open.direction,
      entryOrderType: open.orderType,
      exitOrderType: fill.orderType,
      size: closeSize,
      entryPrice: open.entryPrice,
      exitPrice: fill.price,
      status: "closed",
      occurredAt: open.openedAt,
      closedAt: fill.occurredAt,
      entryOrderId: open.orderId,
      exitOrderId: fill.orderId,
      pnl: fill.pnl,
      raw: [...open.raw, fill.raw].join("\n\n"),
      source: open.source,
    });

    open.remaining -= closeSize;
    open.raw.push(fill.raw);
    if (open.remaining <= 0.0000001) positions.delete(fill.symbol);
  }

  for (const open of positions.values()) {
    trades.push({
      id: makeId([open.symbol, open.openedAt, open.orderId, open.direction, open.remaining]),
      symbol: open.symbol,
      direction: open.direction,
      entryOrderType: open.orderType,
      size: open.remaining,
      entryPrice: open.entryPrice,
      status: "open",
      occurredAt: open.openedAt,
      entryOrderId: open.orderId,
      raw: open.raw.join("\n\n"),
      source: open.source,
    });
  }

  return trades.sort(
    (a, b) =>
      Date.parse((b.closedAt ?? b.occurredAt).replace(" ", "T")) -
      Date.parse((a.closedAt ?? a.occurredAt).replace(" ", "T")),
  );
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
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
  return rows.filter((items) => items.some((item) => item.trim().length > 0));
}
