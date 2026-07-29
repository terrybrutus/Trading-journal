import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMOTION_OPTIONS, ORIGIN_OPTIONS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { EmotionalState, TradeOrigin } from "@/types";
import type { TradeSort } from "@/types";

export interface TradeFilterValues {
  q: string;
  origin: TradeOrigin | "all";
  emotion: EmotionalState | "all";
  dateFrom: string;
  dateTo: string;
  sort: TradeSort;
}

interface Props {
  values: TradeFilterValues;
  onChange: (next: Partial<TradeFilterValues>) => void;
  onReset: () => void;
  className?: string;
}

// "All" sentinel option prepended to the shared label maps from `lib/labels.ts`
// so the filter dropdowns render human-readable title-case labels for every
// backend enum variant while still offering an "all" wildcard.
const ORIGIN_FILTER_OPTIONS: ReadonlyArray<{
  value: TradeOrigin | "all";
  label: string;
}> = [{ value: "all", label: "All origins" }, ...ORIGIN_OPTIONS];

const EMOTION_FILTER_OPTIONS: ReadonlyArray<{
  value: EmotionalState | "all";
  label: string;
}> = [{ value: "all", label: "All states" }, ...EMOTION_OPTIONS];

const SORT_OPTIONS: { value: TradeSort; label: string }[] = [
  { value: "dateDesc" as TradeSort, label: "Newest first" },
  { value: "dateAsc" as TradeSort, label: "Oldest first" },
  { value: "pnlDesc" as TradeSort, label: "P&L high → low" },
  { value: "pnlAsc" as TradeSort, label: "P&L low → high" },
];

export function TradeFilters({ values, onChange, onReset, className }: Props) {
  const hasActiveFilters =
    values.q !== "" ||
    values.origin !== "all" ||
    values.emotion !== "all" ||
    values.dateFrom !== "" ||
    values.dateTo !== "" ||
    values.sort !== "dateDesc";

  return (
    <div
      data-ocid="trade.filters"
      className={cn(
        "bg-card border border-border rounded-lg shadow-subtle p-3 md:p-4",
        "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6",
        className,
      )}
    >
      <div className="lg:col-span-2">
        <label
          htmlFor="trade-search"
          className="text-muted-foreground mb-1 block text-[10px] font-medium uppercase tracking-widest"
        >
          Search symbol
        </label>
        <Input
          id="trade-search"
          data-ocid="trade.search_input"
          type="search"
          placeholder="e.g. AAPL"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>

      <FilterField label="Origin">
        <Select
          value={values.origin}
          onValueChange={(v) => onChange({ origin: v as TradeOrigin | "all" })}
        >
          <SelectTrigger data-ocid="trade.origin_select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORIGIN_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Emotion">
        <Select
          value={values.emotion}
          onValueChange={(v) =>
            onChange({ emotion: v as EmotionalState | "all" })
          }
        >
          <SelectTrigger data-ocid="trade.emotion_select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMOTION_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="From">
        <Input
          data-ocid="trade.date_from_input"
          type="date"
          value={values.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
        />
      </FilterField>

      <FilterField label="To">
        <Input
          data-ocid="trade.date_to_input"
          type="date"
          value={values.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
        />
      </FilterField>

      <FilterField label="Sort">
        <Select
          value={values.sort}
          onValueChange={(v) => onChange({ sort: v as TradeSort })}
        >
          <SelectTrigger data-ocid="trade.sort_select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <div className="flex items-end lg:col-span-6">
        <button
          type="button"
          data-ocid="trade.reset_filters_button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className="text-muted-foreground hover:text-foreground transition-smooth ml-auto text-xs font-medium disabled:opacity-40"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 block text-[10px] font-medium uppercase tracking-widest">
        {label}
      </div>
      {children}
    </div>
  );
}
