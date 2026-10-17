/**
 * Format angka & tanggal untuk dashboard owner.
 *
 * Semua perhitungan "hari ini / 7 hari" memakai zona waktu **Asia/Jakarta (WIB)**,
 * bukan zona waktu server. Kalau tidak, angka "omzet hari ini" bisa geser 7 jam
 * dan menampilkan hasil yang salah.
 */

/** Zona waktu operasional BD Cafe. */
export const WIB = "Asia/Jakarta";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const shortFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** `22000` -> `Rp 22.000` */
export function rupiah(value: number | string | null | undefined): string {
  return rupiahFormatter.format(toNumber(value));
}

/**
 * Versi ringkas untuk sumbu grafik & label yang sempit.
 * `1250000` -> `Rp 1,3 jt`, `850000` -> `Rp 850 rb`, `45000` -> `Rp 45.000`
 */
export function rupiahShort(value: number | string | null | undefined): string {
  const n = toNumber(value);
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `Rp ${shortFormatter.format(n / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `Rp ${shortFormatter.format(n / 1_000_000)} jt`;
  if (abs >= 1_000) return `Rp ${shortFormatter.format(n / 1_000)} rb`;
  return rupiahFormatter.format(n);
}

/** Ukuran file yang enak dibaca: `245000` -> `245 KB`. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Tanggal kalender di WIB sebagai `"YYYY-MM-DD"` — dasar hitungan "hari ini". */
export function wibDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 00:00:00.000 WIB pada hari yang sama. */
export function startOfWibDay(date: Date): Date {
  return new Date(`${wibDateKey(date)}T00:00:00+07:00`);
}

/** 23:59:59.999 WIB pada hari yang sama. */
export function endOfWibDay(date: Date): Date {
  return new Date(`${wibDateKey(date)}T23:59:59.999+07:00`);
}

/**
 * Tambah/hari kurangi beberapa hari.
 * Aman untuk WIB karena zona ini tidak punya DST — satu hari selalu 86.400.000 ms.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Granularitas bucket yang didukung function `get_sales_report` di database. */
export type ReportPeriod = "hour" | "day" | "week" | "month";

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  hour: "Per Jam",
  day: "Per Hari",
  week: "Per Minggu",
  month: "Per Bulan",
};

/** Label sumbu X sesuai granularitas bucket. */
export function formatBucketLabel(bucket: string, period: ReportPeriod): string {
  const date = new Date(bucket);

  switch (period) {
    case "hour":
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: WIB,
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    case "day":
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: WIB,
        day: "numeric",
        month: "short",
      }).format(date);
    case "week":
      return `${new Intl.DateTimeFormat("id-ID", {
        timeZone: WIB,
        day: "numeric",
        month: "short",
      }).format(date)}`;
    case "month":
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: WIB,
        month: "short",
        year: "2-digit",
      }).format(date);
  }
}

/** Rentang tanggal siap pakai yang bisa dipilih owner. */
export type RangePreset = "today" | "7d" | "30d" | "90d";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "90d", label: "90 hari" },
];

/**
 * Rentang default per preset.
 *
 * Granularitas bucket ikut menyesuaikan supaya chart tidak PENUH: menumpuk 90
 * titik per hari untuk grafik 90 hari akan membuatnya tidak terbaca.
 */
export const DEFAULT_PERIOD: Record<RangePreset, ReportPeriod> = {
  today: "hour",
  "7d": "day",
  "30d": "day",
  "90d": "week",
};

export function resolveRange(
  preset: RangePreset,
  now: Date = new Date()
): { start: Date; end: Date; label: string } {
  const todayStart = startOfWibDay(now);
  const todayEnd = endOfWibDay(now);

  switch (preset) {
    case "today":
      return { start: todayStart, end: todayEnd, label: "Hari ini" };
    case "7d":
      return {
        start: addDays(todayStart, -6),
        end: todayEnd,
        label: "7 hari terakhir",
      };
    case "30d":
      return {
        start: addDays(todayStart, -29),
        end: todayEnd,
        label: "30 hari terakhir",
      };
    case "90d":
      return {
        start: addDays(todayStart, -89),
        end: todayEnd,
        label: "90 hari terakhir",
      };
  }
}

/** Parse nilai dari URL searchParams, jatuh ke `fallback` kalau tidak dikenal. */
export function parsePreset(
  value: string | string[] | undefined,
  fallback: RangePreset
): RangePreset {
  const raw = Array.isArray(value) ? value[0] : value;
  return RANGE_PRESETS.some((p) => p.value === raw) ? (raw as RangePreset) : fallback;
}

export function parsePeriod(
  value: string | string[] | undefined,
  fallback: ReportPeriod
): ReportPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "hour" || raw === "day" || raw === "week" || raw === "month"
    ? raw
    : fallback;
}
