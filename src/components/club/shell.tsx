import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BarChart3, CupSoda, LayoutGrid, Settings2 } from "lucide-react";
import { SyncIndicator } from "@/components/club/sync-indicator";
import { useNow } from "@/hooks/use-now";
import { tashkentClock } from "@/lib/club/money";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Stollar", icon: LayoutGrid },
  { to: "/bar", label: "Bar", icon: CupSoda },
  { to: "/hisobot", label: "Hisobot", icon: BarChart3 },
  { to: "/sozlamalar", label: "Sozlama", icon: Settings2 },
] as const;

export function ClubShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow(30_000);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-medium tracking-tight">
              KIY
            </span>
            <span className="hidden text-xs tracking-[0.18em] text-muted uppercase sm:inline">
              bilyard klubi
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <SyncIndicator />

            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <time
              dateTime={now > 0 ? new Date(now).toISOString() : undefined}
              className="font-mono text-sm tabular-nums text-muted"
            >
              {now > 0 ? tashkentClock(new Date(now)) : "\u00a0"}
            </time>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium tracking-wide",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
