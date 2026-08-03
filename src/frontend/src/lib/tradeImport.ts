import { Direction } from "@/types";

export type ImportedTradeRow = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  direction: Direction;
  orderType: string;
  size: number;
  filledSize?: number;
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

  return body.flatMap((row) => {
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

    return [
      {
        id: makeId([symbol, occurredAt, orderId, side, size, price]),
        symbol,
        side,
        direction: directionFor(side),
        orderType: title.replace(/\s+on\s+.*$/i, "").replace(/\s+executed/i, "").trim() || "Order",
        size,
        filledSize: size,
        price,
        status: "filled",
        occurredAt,
        orderId,
        raw: [title, text].join(" - "),
        source: "csv" as const,
      },
    ];
  });
}

export function parsePastedTradingPanel(input: string): ImportedTradeRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ImportedTradeRow[] = [];

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
    const pnl = detailParts
      .map((part) => cleanNumber(part))
      .find((value) => value !== undefined && value !== 0);
    const price = prices.at(-1);

    if (!occurredAt || price === undefined || status !== "filled") continue;

    rows.push({
      id: makeId([symbol, occurredAt, orderId, side, size, price]),
      symbol,
      side,
      direction: directionFor(side),
      orderType,
      size,
      filledSize,
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

  return rows;
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
