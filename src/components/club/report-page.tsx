import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { getReport, getMonthlyReport } from "@/lib/club/api";
import { lockPin } from "@/lib/club/pin-auth";
import { formatDayLabel, formatSom, tashkentDay } from "@/lib/club/money";
import { PAY_LABEL } from "@/lib/club/types";


function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+05:00`);
  d.setDate(d.getDate() + delta);
  return tashkentDay(d);
}

function currentMonth(): string {
  return tashkentDay().slice(0, 7); // "YYYY-MM"
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const UZ_MONTHS = [
    "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
    "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
  ];
  const [y, m] = month.split("-").map(Number);
  return `${UZ_MONTHS[m! - 1]} ${y}`;
}

type ViewMode = "daily" | "monthly";

export function ReportPage() {
  const [mode, setMode] = useState<ViewMode>("daily");
  const [day, setDay] = useState(() => tashkentDay());
  const [month, setMonth] = useState(() => currentMonth());
  const [chartReady, setChartReady] = useState(false);

  const { data: dayData, isPending: dayPending } = useQuery({
    queryKey: ["report", day],
    queryFn: () => getReport({ data: { day } }),
    enabled: mode === "daily",
  });

  const { data: monthData, isPending: monthPending } = useQuery({
    queryKey: ["report-monthly", month],
    queryFn: () => getMonthlyReport({ data: { month } }),
    enabled: mode === "monthly",
  });

  useEffect(() => {
    setChartReady(true);
  }, []);

  const isPending = mode === "daily" ? dayPending : monthPending;

  // ── Daily view ──────────────────────────────────────────────
  const dayTotal = dayData ? dayData.byPay.naqd + dayData.byPay.karta : 0;
  const dayChart = (dayData?.hourly ?? []).filter((h) => {
    const n = Number(h.hour);
    return n >= 8 && n <= 23;
  });

  // ── Monthly view ────────────────────────────────────────────
  const monthChart = (monthData?.days ?? []).map((d) => ({
    label: String(Number(d.day.slice(8))), // day number
    total: d.total,
    naqd: d.naqd,
    karta: d.karta,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted uppercase">
            Statistika
          </p>
          <h1 className="font-display text-3xl font-medium">Hisobot</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            {(["daily", "monthly"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-background text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {m === "daily" ? "Kunlik" : "Oylik"}
              </button>
            ))}
          </div>

          {/* Lock button */}
          <button
            type="button"
            onClick={() => {
              lockPin();
              window.location.href = "/";
            }}
            title="Adminni qulflash"
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted transition-colors hover:bg-surface hover:text-foreground active:scale-95"
          >
            <Lock className="size-4" />
          </button>
        </div>
      </div>


      {/* ── DAILY MODE ── */}
      {mode === "daily" && (
        <>
          {/* Day navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDay((d) => shiftDay(d, -1))}
              aria-label="Oldingi kun"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="min-w-40 text-center text-sm font-medium">
              {formatDayLabel(day)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDay((d) => shiftDay(d, 1))}
              aria-label="Keyingi kun"
              disabled={day >= tashkentDay()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Tushum" value={formatSom(dayTotal)} />
            <Stat label="Seanslar" value={String(dayData?.sessionCount ?? 0)} />
            <Stat label="Naqd" value={formatSom(dayData?.byPay.naqd ?? 0)} />
            <Stat label="Karta" value={formatSom(dayData?.byPay.karta ?? 0)} />
          </div>

          {/* Hourly chart */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-medium">Soat kesimida</h2>
            <div className="mt-3 h-48 min-w-0">
              {isPending || !chartReady ? (
                <div className="h-full animate-pulse rounded-lg bg-surface-2" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayChart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(value) => [formatSom(Number(value ?? 0)), "Tushum"]}
                      labelFormatter={(label) => `${label}:00`}
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--color-primary)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Products + tickets */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-medium">Mahsulotlar</h2>
              {dayData && dayData.topProducts.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Bugun bar savdosi yo'q.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(dayData?.topProducts ?? []).map((p) => (
                    <li key={p.name} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        {p.name}
                        <span className="ml-2 text-xs text-muted">×{p.qty}</span>
                      </span>
                      <span className="tabular-nums">{formatSom(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-medium">Yopilgan seanslar</h2>
              {dayData && dayData.tickets.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Bu kunda yopilgan seans yo'q.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {(dayData?.tickets ?? []).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-baseline justify-between gap-3 py-2 text-sm"
                    >
                      <span>
                        {t.kind === "bar" ? "Bar" : (t.tableName ?? "Stol")}
                        <span className="ml-2 text-xs text-muted">
                          {t.payMethod ? PAY_LABEL[t.payMethod] : ""}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatSom(t.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* ── MONTHLY MODE ── */}
      {mode === "monthly" && (
        <>
          {/* Month navigator */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Oldingi oy"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="min-w-44 text-center text-sm font-medium">
              {formatMonthLabel(month)}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Keyingi oy"
              disabled={month >= currentMonth()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Monthly stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Oylik tushum" value={formatSom(monthData?.totalRevenue ?? 0)} />
            <Stat label="Seanslar" value={String(monthData?.totalSessions ?? 0)} />
            <Stat label="Naqd" value={formatSom(monthData?.totalNaqd ?? 0)} />
            <Stat label="Karta" value={formatSom(monthData?.totalKarta ?? 0)} />
          </div>

          {/* Daily bar chart for the month */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-medium">Kunlik tushum</h2>
            <div className="mt-3 h-56 min-w-0">
              {isPending || !chartReady ? (
                <div className="h-full animate-pulse rounded-lg bg-surface-2" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthChart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        color: "var(--color-foreground)",
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [
                        formatSom(Number(value ?? 0)),
                        name === "naqd" ? "Naqd" : name === "karta" ? "Karta" : "Jami",
                      ]}
                      labelFormatter={(label) => `${label}-kun`}
                    />
                    <Bar
                      dataKey="naqd"
                      stackId="a"
                      fill="var(--color-primary)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="karta"
                      stackId="a"
                      fill="color-mix(in oklab, var(--color-primary) 50%, var(--color-surface-2))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-primary" />
                Naqd
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: "color-mix(in oklab, var(--color-primary) 50%, var(--color-surface-2))" }} />
                Karta
              </span>
            </div>
          </section>

          {/* Daily table */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-medium">Kunlik jadval</h2>
            {monthData && monthData.days.every((d) => d.total === 0) ? (
              <p className="mt-3 text-sm text-muted">Bu oyda ma'lumot yo'q.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="pb-2 font-medium">Kun</th>
                      <th className="pb-2 text-right font-medium">Seanslar</th>
                      <th className="pb-2 text-right font-medium">Naqd</th>
                      <th className="pb-2 text-right font-medium">Karta</th>
                      <th className="pb-2 text-right font-medium">Jami</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(monthData?.days ?? [])
                      .filter((d) => d.total > 0)
                      .map((d) => (
                        <tr key={d.day} className="py-1">
                          <td className="py-1.5 tabular-nums">{formatDayLabel(d.day)}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted">{d.sessions}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatSom(d.naqd)}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatSom(d.karta)}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{formatSom(d.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-medium">
                      <td className="pt-2">Jami</td>
                      <td className="pt-2 text-right tabular-nums text-muted">{monthData?.totalSessions ?? 0}</td>
                      <td className="pt-2 text-right tabular-nums">{formatSom(monthData?.totalNaqd ?? 0)}</td>
                      <td className="pt-2 text-right tabular-nums">{formatSom(monthData?.totalKarta ?? 0)}</td>
                      <td className="pt-2 text-right tabular-nums">{formatSom(monthData?.totalRevenue ?? 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-xl font-medium tabular-nums">
        {value}
      </p>
    </div>
  );
}