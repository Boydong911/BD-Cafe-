"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERIOD_LABELS,
  RANGE_PRESETS,
  type RangePreset,
  type ReportPeriod,
} from "@/lib/format";

/**
 * Filter rentang & granularitas laporan.
 *
 * State disimpan di query string (bukan `useState`) supaya pilihan owner
 * bisa di-bookmark, dibagikan, dan tetap jalan saat halaman di-refresh.
 */
export function SalesFilter({
  preset,
  period,
}: {
  preset: RangePreset;
  period: ReportPeriod;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(nextPreset: RangePreset, nextPeriod: ReportPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", nextPreset);
    params.set("period", nextPeriod);
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  const periodOptions = Object.entries(PERIOD_LABELS) as [
    ReportPeriod,
    string,
  ][];

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm",
        isPending && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        Rentang
      </div>

      <div
        role="group"
        aria-label="Pilih rentang tanggal"
        className="flex flex-wrap gap-1.5"
      >
        {RANGE_PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => navigate(option.value, period)}
            aria-pressed={preset === option.value}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              preset === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label
          htmlFor="period"
          className="text-sm text-muted-foreground whitespace-nowrap"
        >
          Granularitas
        </label>
        <select
          id="period"
          value={period}
          onChange={(event) =>
            navigate(preset, event.target.value as ReportPeriod)
          }
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {periodOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
