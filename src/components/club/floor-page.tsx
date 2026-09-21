import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeltTable } from "@/components/club/felt-table";
import { SessionPanel } from "@/components/club/session-panel";
import { useNow } from "@/hooks/use-now";
import { useOnline } from "@/hooks/use-online";
import { getFloor } from "@/lib/club/api";
import { offlineStartSession } from "@/lib/club/offline-ops";
import { saveFloor } from "@/lib/offline/local-floor";
import {
  elapsedMs,
  formatElapsed,
  formatSom,
  timeCharge,
} from "@/lib/club/money";
import { KIND_LABEL, type FloorPayload, type FloorTable, type OpenSession } from "@/lib/club/types";
import { cn } from "@/lib/utils";

export function FloorPage({ initial }: { initial: FloorPayload }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["floor"],
    queryFn: async () => {
      const result = await getFloor();
      // Keep IndexedDB cache fresh on every successful fetch
      saveFloor(result).catch(() => {});
      return result;
    },
    initialData: initial,
    refetchInterval: online ? 12_000 : false,
    refetchOnWindowFocus: online,
  });

  const startMut = useMutation({
    mutationFn: (tableId: number) =>
      offlineStartSession(tableId, queryClient, online),
    onSuccess: (_res, tableId) => setOpenId(tableId),
    onError: (err) => toast.error(err.message),
  });

  const occupied = data.tables.filter((t) => t.session).length;
  const selected = data.tables.find((t) => t.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Zal</p>
          <h1 className="font-display text-3xl font-medium">Stollar</h1>
        </div>
        <div className="flex gap-6">
          <Metric label="Band" value={`${occupied}/${data.tables.length}`} />
          <LiveTodayTotal
            closedTotal={data.todayClosedTotal}
            tables={data.tables}
          />
        </div>
      </div>

      {data.tables.length === 0 ? (
        <EmptyFloor />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.tables.map((table) => (
            <li key={table.id}>
              <TableCard
                table={table}
                busy={startMut.isPending}
                onStart={() => startMut.mutate(table.id)}
                onOpen={() => setOpenId(table.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <SessionPanel
          table={selected}
          products={data.products}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function LiveTodayTotal({
  closedTotal,
  tables,
}: {
  closedTotal: number;
  tables: FloorTable[];
}) {
  const now = useNow(5000);
  const liveOpen = tables.reduce((sum, table) => {
    if (!table.session) return sum;
    const charge = timeCharge(
      table.session.hourlyRate,
      table.session.startedAt,
      now || Date.now(),
    );
    const items = table.session.items.reduce(
      (s, i) => s + i.unitPrice * i.qty,
      0,
    );
    return sum + charge + items;
  }, 0);
  return <Metric label="Bugun" value={formatSom(closedTotal + liveOpen)} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="font-mono text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

const TableCard = memo(function TableCard({
  table,
  busy,
  onStart,
  onOpen,
}: {
  table: FloorTable;
  busy: boolean;
  onStart: () => void;
  onOpen: () => void;
}) {
  const occupied = Boolean(table.session);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface p-3 transition-[box-shadow,border-color] duration-200",
        occupied ? "border-primary/40" : "border-border",
      )}
    >
      <FeltTable occupied={occupied} />
      <div className="flex items-start justify-between gap-2 px-1">
        <div>
          <h2 className="font-display text-xl font-medium">{table.name}</h2>
          <p className="text-xs text-muted">
            {KIND_LABEL[table.kind]} · {formatSom(table.hourlyRate)}/soat
          </p>
        </div>
        <Badge variant={occupied ? "default" : "muted"}>
          {occupied ? "Band" : "Bo‘sh"}
        </Badge>
      </div>
      {table.session ? (
        <LiveOccupiedInfo session={table.session} onOpen={onOpen} />
      ) : (
        <Button
          className="w-full"
          variant="secondary"
          disabled={busy}
          onClick={onStart}
        >
          Boshlash
        </Button>
      )}
    </article>
  );
});

function LiveOccupiedInfo({
  session,
  onOpen,
}: {
  session: OpenSession;
  onOpen: () => void;
}) {
  const now = useNow(1000);
  const currentTime = now || Date.now();
  const charge = timeCharge(session.hourlyRate, session.startedAt, currentTime);
  const items = session.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const elapsed = elapsedMs(session.startedAt, currentTime);

  return (
    <div className="flex items-end justify-between px-1">
      <div>
        <p className="font-mono text-lg tabular-nums">
          {formatElapsed(elapsed)}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {formatSom(charge + items)}
        </p>
      </div>
      <Button size="sm" onClick={onOpen}>
        Ochish
      </Button>
    </div>
  );
}


function EmptyFloor() {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-16 text-center">
      <p className="font-display text-xl">Hali stol yo‘q</p>
      <p className="mt-1 text-sm text-muted">
        Sozlamalardan stol qo‘shing — zal shu yerda ochiladi.
      </p>
    </div>
  );
}

export function FloorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}
