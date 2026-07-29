import {
  type TradeFilterValues,
  TradeFilters,
} from "@/components/TradeFilters";
import { TradeList } from "@/components/TradeList";
import { toTradeListFilter, useListTrades } from "@/hooks/useTrades";
import {
  DEFAULT_JOURNAL_SEARCH,
  JOURNAL_PAGE_SIZE,
  type JournalSearch,
} from "@/types";
import { useSearch } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

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

      <TradeFilters
        values={filterValues}
        onChange={handleChange}
        onReset={handleReset}
      />

      <TradeList
        trades={data?.items}
        isLoading={isLoading}
        isError={isError}
        total={data?.total}
        offset={offset}
        limit={limit}
      />
    </div>
  );
}
