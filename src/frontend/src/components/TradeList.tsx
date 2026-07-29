import { ShareLinkButton } from "@/components/ShareLinkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { directionLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Direction, type Trade } from "@/types";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Pencil } from "lucide-react";

interface Props {
  trades: Trade[] | undefined;
  isLoading: boolean;
  isError: boolean;
  total: bigint | undefined;
  offset: bigint;
  limit: bigint;
}

export function TradeList({
  trades,
  isLoading,
  isError,
  total,
  offset,
  limit,
}: Props) {
  if (isLoading) {
    return (
      <div
        data-ocid="trade.list.loading_state"
        className="bg-card border border-border rounded-lg shadow-subtle divide-y divide-border"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, order never changes
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="ml-auto h-5 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-ocid="trade.list.error_state"
        className="bg-card border border-destructive/40 rounded-lg p-8 text-center"
      >
        <p className="text-destructive text-sm font-medium">
          Couldn’t load trades
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Check your connection and try again.
        </p>
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div
        data-ocid="trade.list.empty_state"
        className="bg-card border border-border rounded-lg p-10 text-center"
      >
        <p className="font-display text-lg font-semibold">No trades yet</p>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm mx-auto">
          Log your first trade to start building your bias signature history.
        </p>
        <Button asChild className="mt-4" data-ocid="trade.list.empty_cta">
          <Link to="/trades/new">Log a trade</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        data-ocid="trade.list"
        className="bg-card border border-border rounded-lg shadow-subtle divide-y divide-border overflow-hidden"
      >
        <TradeListHeader />
        <ol>
          {trades.map((trade, index) => (
            <TradeRow key={trade.id.toString()} trade={trade} index={index} />
          ))}
        </ol>
      </div>
      <ListFooter total={total} offset={offset} limit={limit} />
    </div>
  );
}

function TradeListHeader() {
  return (
    <div className="bg-secondary/40 text-muted-foreground grid grid-cols-[1.5fr_0.8fr_1fr_1fr_1.2fr_0.8fr_1fr] gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-widest">
      <span>Symbol</span>
      <span>Dir</span>
      <span className="text-right">Entry</span>
      <span className="text-right">Exit</span>
      <span className="text-right">P&L</span>
      <span className="text-right">Conf.</span>
      <span className="text-right">Actions</span>
    </div>
  );
}

function TradeRow({ trade, index }: { trade: Trade; index: number }) {
  const pnl = trade.realizedPnl;
  const pnlPositive = typeof pnl === "number" && pnl >= 0;
  const entryDate = new Date(Number(trade.entryAtNs / 1_000_000n));

  return (
    <li
      data-ocid={`trade.item.${index}`}
      className="grid grid-cols-[1.5fr_0.8fr_1fr_1fr_1.2fr_0.8fr_1fr] items-center gap-2 px-4 py-3 text-sm transition-smooth hover:bg-accent/30"
    >
      <div className="min-w-0">
        <Link
          to="/trades/$tradeId"
          params={{ tradeId: trade.id.toString() }}
          className="font-mono font-medium hover:text-primary transition-smooth truncate block"
        >
          {trade.symbol}
        </Link>
        <div className="text-muted-foreground text-[11px] truncate">
          {format(entryDate, "MMM d, yyyy")}
          {trade.isDraft && (
            <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0">
              Draft
            </Badge>
          )}
        </div>
      </div>

      <DirectionBadge direction={trade.direction} />

      <span className="text-right font-mono tabular-nums">
        {formatPrice(trade.entryPrice)}
      </span>
      <span className="text-right font-mono tabular-nums">
        {typeof trade.exitPrice === "number"
          ? formatPrice(trade.exitPrice)
          : "—"}
      </span>
      <span
        className={cn(
          "text-right font-mono tabular-nums font-medium",
          pnl === undefined
            ? "text-muted-foreground"
            : pnlPositive
              ? "text-success"
              : "text-destructive",
        )}
      >
        {pnl === undefined ? "—" : formatPnl(pnl)}
      </span>
      <span className="text-right font-mono tabular-nums text-muted-foreground">
        {trade.confidenceRating.toString()}
      </span>
      <div className="flex justify-end items-center gap-1">
        <ShareLinkButton
          url={trade.shareableUrl ?? `/trades/${trade.id.toString()}`}
          compact
          label={`Copy share link for ${trade.symbol}`}
        />
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-7"
          data-ocid={`trade.open_button.${index}`}
          aria-label={`Open ${trade.symbol} detail`}
        >
          <Link to="/trades/$tradeId" params={{ tradeId: trade.id.toString() }}>
            <Pencil className="size-3.5" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

function DirectionBadge({ direction }: { direction: Direction }) {
  const isLong = direction === Direction.long_;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isLong ? "text-success" : "text-destructive",
      )}
    >
      {isLong ? (
        <ArrowUpRight className="size-3.5" />
      ) : (
        <ArrowDownRight className="size-3.5" />
      )}
      {directionLabel(direction)}
    </span>
  );
}

function ListFooter({
  total,
  offset,
  limit,
}: {
  total: bigint | undefined;
  offset: bigint;
  limit: bigint;
}) {
  const totalNum = total === undefined ? undefined : Number(total);
  const from = totalNum ? Number(offset) + 1 : 0;
  const to = totalNum ? Math.min(Number(offset) + Number(limit), totalNum) : 0;
  return (
    <div className="text-muted-foreground flex items-center justify-between text-xs">
      <span>
        {totalNum === undefined
          ? "—"
          : totalNum === 0
            ? "No results"
            : `Showing ${from}–${to} of ${totalNum}`}
      </span>
      <span className="font-mono">QUANTUM Journal</span>
    </div>
  );
}

function formatPrice(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
