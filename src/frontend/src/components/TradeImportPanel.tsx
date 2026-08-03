import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTrade } from "@/hooks";
import {
  type ImportedTradeRow,
  parseBrokerImport,
} from "@/lib/tradeImport";
import { Direction, EmotionalState, TradeOrigin } from "@/types";
import { Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function nsFromDateTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const ms = Date.parse(normalized);
  return BigInt(Number.isNaN(ms) ? Date.now() : ms) * 1_000_000n;
}

function rowNote(row: ImportedTradeRow) {
  return [
    `Broker import: ${row.source.toUpperCase()}`,
    `Order type: ${row.orderType}`,
    `Status: ${row.status}`,
    row.orderId ? `Order ID: ${row.orderId}` : undefined,
    row.linkedOrderId ? `Linked order: ${row.linkedOrderId}` : undefined,
    row.pnl !== undefined ? `Imported P/L: ${row.pnl}` : undefined,
    "",
    row.raw,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function sideLabel(direction: Direction) {
  return direction === Direction.short_ ? "Short" : "Long";
}

export function TradeImportPanel() {
  const createTrade = useCreateTrade();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<ImportedTradeRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sourceLabel, setSourceLabel] = useState("");

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.id)),
    [rows, selected],
  );

  function loadRows(nextRows: ImportedTradeRow[], label: string) {
    setRows(nextRows);
    setSelected(new Set(nextRows.map((row) => row.id)));
    setSourceLabel(label);
    if (nextRows.length === 0) {
      toast("No filled trades found", {
        description: "Try a TradingView notification CSV or copied trading panel text.",
      });
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    loadRows(parseBrokerImport(text, "csv"), file.name);
  }

  function parseText() {
    loadRows(parseBrokerImport(rawText, "text"), "Pasted text");
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createSelectedDrafts() {
    if (selectedRows.length === 0) return;
    try {
      for (const row of selectedRows) {
        await createTrade.mutateAsync({
          symbol: row.symbol,
          direction: row.direction,
          tradeOrigin: TradeOrigin.selfGenerated,
          entryPrice: row.price,
          exitPrice: undefined,
          positionSize: row.filledSize ?? row.size,
          confidenceRating: 1n,
          preTradeThesis: {
            thesis: "Imported broker execution. Add thesis/reflection before final review.",
            counterReasons: [],
          },
          preSessionEmotion: {
            state: EmotionalState.neutral,
            note: "",
            capturedAtNs: nsFromDateTime(row.occurredAt),
          },
          realizedPnl: row.pnl,
          outcomeReasoning: rowNote(row),
          entryAtNs: nsFromDateTime(row.occurredAt),
          isDraft: true,
        });
      }
      toast.success("Imported draft trades", {
        description: `${selectedRows.length} draft${selectedRows.length === 1 ? "" : "s"} created.`,
      });
      setSelected(new Set());
    } catch (_error) {
      toast.error("Import failed", {
        description: "No rows were deleted. Review the parsed rows and retry.",
      });
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Import broker executions
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload TradingView notification CSVs or paste copied trading panel rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Textarea
            rows={4}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste copied TradingView broker panel rows here..."
          />
          <Button type="button" variant="secondary" onClick={parseText} disabled={!rawText.trim()}>
            Parse text
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {rows.length} filled execution{rows.length === 1 ? "" : "s"} from {sourceLabel}
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set(rows.map((row) => row.id)))}>
                  Select all
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button type="button" size="sm" onClick={createSelectedDrafts} disabled={selectedRows.length === 0 || createTrade.isPending}>
                  Create {selectedRows.length} draft{selectedRows.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-9 p-2">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Symbol</th>
                    <th className="p-2">Side</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">P/L</th>
                    <th className="p-2">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                      <td className="p-2 font-mono text-muted-foreground">{row.occurredAt}</td>
                      <td className="p-2 font-semibold">{row.symbol}</td>
                      <td className="p-2">{sideLabel(row.direction)}</td>
                      <td className="p-2 font-mono">{row.filledSize ?? row.size}</td>
                      <td className="p-2 font-mono">{row.price.toFixed(2)}</td>
                      <td className="p-2 font-mono">{row.pnl === undefined ? "-" : row.pnl.toFixed(2)}</td>
                      <td className="p-2 text-muted-foreground">{row.orderType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
