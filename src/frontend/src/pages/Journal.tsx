import {
  type TradeFilterValues,
  TradeFilters,
} from "@/components/TradeFilters";
import { TradeImportPanel } from "@/components/TradeImportPanel";
import { TradeList } from "@/components/TradeList";
import {
  toTradeListFilter,
  useDeleteTrade,
  useListTrades,
} from "@/hooks/useTrades";
import {
  DEFAULT_JOURNAL_SEARCH,
  JOURNAL_PAGE_SIZE,
  type JournalSearch,
} from "@/types";
import { useSearch } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Journal shell — wires TradeFilters + TradeList to URL search state.
 * Filter and sort state persists in the URL so views are shareable and
 * survive refresh. Page tasks will add pagination controls and richer
 * empty states.
 */
export function Journal() {
  const search = useSearch({ strict: false }) as JournalSearch;
  const navigate = useNavigate();

  const merged: JournalSearch = useMemo(
    () => ({ ...DEFAULT_JOURNAL_SEARCH, ...search }),
    [search],
  );

  const filterValues: TradeFilterValues = {
    q: merged.q ?? "",
    origin: (merged.origin ?? "all") as TradeFilterValues["origin"],
    emotion: (merged.emotion ?? "all") as TradeFilterValues["emotion"],
    dateFrom: merged.dateFrom ?? "",
    dateTo: merged.dateTo ?? "",
    sort: (merged.sort ?? "dateDesc") as TradeFilterValues["sort"],
  };

  const page = Math.max(1, merged.page ?? 1);
  const limit = BigInt(JOURNAL_PAGE_SIZE);
  const offset = BigInt((page - 1) * JOURNAL_PAGE_SIZE);

  const filter = useMemo(() => toTradeListFilter(merged), [merged]);

  const { data, isLoading, isError } = useListTrades(filter, limit, offset);
  const deleteTrade = useDeleteTrade();
  const view = merged.view ?? "active";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localBins, setLocalBins] = useState(() => readBins());

  const visibleTrades = useMemo(() => {
    const archived = localBins.archived;
    const trashed = localBins.trashed;
    return (data?.items ?? []).filter((trade) => {
      const id = trade.id.toString();
      if (view === "archive") return archived.has(id) && !trashed.has(id);
      if (view === "trash") return trashed.has(id);
      return !archived.has(id) && !trashed.has(id);
    });
  }, [data?.items, localBins, view]);

  const selectedVisibleIds = useMemo(
    () => visibleTrades.map((trade) => trade.id.toString()).filter((id) => selectedIds.has(id)),
    [selectedIds, visibleTrades],
  );

  function pushSearch(next: Partial<JournalSearch>) {
    void navigate({
      to: "/journal",
      search: (prev: JournalSearch) => ({ ...prev, ...next, page: 1 }),
    });
  }

  function handleChange(next: Partial<TradeFilterValues>) {
    pushSearch(next as Partial<JournalSearch>);
  }

  function handleReset() {
    void navigate({
      to: "/journal",
      search: () => ({ ...DEFAULT_JOURNAL_SEARCH }),
    });
  }

  function setView(nextView: "active" | "archive" | "trash") {
    setSelectedIds(new Set());
    void navigate({
      to: "/journal",
      search: (prev: JournalSearch) => ({ ...prev, view: nextView, page: 1 }),
    });
  }

  function writeBins(next: JournalBins) {
    setLocalBins(next);
    saveBins(next);
    setSelectedIds(new Set());
  }

  function archiveSelected() {
    writeBins({
      archived: new Set([...localBins.archived, ...selectedVisibleIds]),
      trashed: new Set([...localBins.trashed].filter((id) => !selectedVisibleIds.includes(id))),
    });
  }

  function trashSelected() {
    writeBins({
      archived: new Set([...localBins.archived].filter((id) => !selectedVisibleIds.includes(id))),
      trashed: new Set([...localBins.trashed, ...selectedVisibleIds]),
    });
  }

  function restoreSelected() {
    writeBins({
      archived: new Set([...localBins.archived].filter((id) => !selectedVisibleIds.includes(id))),
      trashed: new Set([...localBins.trashed].filter((id) => !selectedVisibleIds.includes(id))),
    });
  }

  async function deleteSelectedForever() {
    for (const id of selectedVisibleIds) {
      await deleteTrade.mutateAsync(BigInt(id));
    }
    writeBins({
      archived: new Set([...localBins.archived].filter((id) => !selectedVisibleIds.includes(id))),
      trashed: new Set([...localBins.trashed].filter((id) => !selectedVisibleIds.includes(id))),
    });
  }

  return (
    <div className="space-y-4 animate-fade-in" data-ocid="journal.page">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Trade journal
          </h2>
          <p className="text-muted-foreground text-sm">
            Search, filter, and review every entry. Views are shareable via URL.
          </p>
        </div>
      </div>

      <TradeImportPanel />

      <TradeFilters
        values={filterValues}
        onChange={handleChange}
        onReset={handleReset}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          {(["active", "archive", "trash"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-smooth ${
                view === item
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {item === "active" ? "Active" : item === "archive" ? "Archive" : "Trash"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedVisibleIds.length} selected
          </span>
          {view === "active" && (
            <>
              <button type="button" disabled={selectedVisibleIds.length === 0} onClick={archiveSelected} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">
                <Archive className="size-3.5" /> Archive
              </button>
              <button type="button" disabled={selectedVisibleIds.length === 0} onClick={trashSelected} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">
                <Trash2 className="size-3.5" /> Trash
              </button>
            </>
          )}
          {view === "archive" && (
            <>
              <button type="button" disabled={selectedVisibleIds.length === 0} onClick={restoreSelected} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">
                <RotateCcw className="size-3.5" /> Restore
              </button>
              <button type="button" disabled={selectedVisibleIds.length === 0} onClick={trashSelected} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">
                <Trash2 className="size-3.5" /> Move to trash
              </button>
            </>
          )}
          {view === "trash" && (
            <>
              <button type="button" disabled={selectedVisibleIds.length === 0} onClick={restoreSelected} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40">
                <RotateCcw className="size-3.5" /> Restore
              </button>
              <button type="button" disabled={selectedVisibleIds.length === 0 || deleteTrade.isPending} onClick={deleteSelectedForever} className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-40">
                <Trash2 className="size-3.5" /> Delete forever
              </button>
            </>
          )}
        </div>
      </div>

      <TradeList
        trades={visibleTrades}
        isLoading={isLoading}
        isError={isError}
        total={data?.total}
        offset={offset}
        limit={limit}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />
    </div>
  );
}

type JournalBins = {
  archived: Set<string>;
  trashed: Set<string>;
};

const JOURNAL_BINS_KEY = "quantumJournalBins";

function readBins(): JournalBins {
  try {
    const raw = window.localStorage.getItem(JOURNAL_BINS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      archived: new Set(Array.isArray(parsed.archived) ? parsed.archived : []),
      trashed: new Set(Array.isArray(parsed.trashed) ? parsed.trashed : []),
    };
  } catch {
    return { archived: new Set(), trashed: new Set() };
  }
}

function saveBins(bins: JournalBins) {
  window.localStorage.setItem(
    JOURNAL_BINS_KEY,
    JSON.stringify({
      archived: [...bins.archived],
      trashed: [...bins.trashed],
    }),
  );
}
