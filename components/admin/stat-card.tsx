import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "muted" | "warning";

const toneStyles: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-emerald-700 dark:text-emerald-400",
  muted: "text-muted-foreground",
  warning: "text-amber-700 dark:text-amber-400",
};

/**
 * Satu kartu metrik untuk dashboard owner.
 *
 * `value` sengaja dibiarkan `string` supaya pemanggil yang sudah memformat
 * (mis. `rupiah()` atau `rupiahShort()`) tidak perlu pembayaran ulang.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span className="rounded-lg bg-background/60 p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-3 font-serif text-2xl font-bold tabular-nums",
          toneStyles[tone]
        )}
      >
        {value}
      </p>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
