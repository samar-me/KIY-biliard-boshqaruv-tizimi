import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReceiptCard } from "@/components/club/receipt-card";
import { useNow } from "@/hooks/use-now";
import { useOnline } from "@/hooks/use-online";
import {
  offlineAddItem,
  offlineBumpItem,
  offlineCancelSession,
  offlineCloseSession,
} from "@/lib/club/offline-ops";
import {
  elapsedMs,
  formatElapsed,
  formatSom,
  timeCharge,
} from "@/lib/club/money";
import type { FloorTable, PayMethod, Product, Receipt } from "@/lib/club/types";
import { CATEGORY_LABEL, PAY_LABEL } from "@/lib/club/types";
import { cn } from "@/lib/utils";

export function SessionPanel({
  table,
  products,
  onClose,
}: {
  table: FloorTable;
  products: Product[];
  onClose: () => void;
}) {
  const lastSessionRef = useRef(table.session);
  if (table.session) {
    lastSessionRef.current = table.session;
  }
  const session = table.session ?? lastSessionRef.current;
  const now = useNow(1000);
  const online = useOnline();

  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [category, setCategory] = useState<"all" | Product["category"]>("all");

  const charge = session
    ? timeCharge(session.hourlyRate, session.startedAt, now)
    : 0;
  const itemsTotal = session
    ? session.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
    : 0;
  const total = charge + itemsTotal;
  const elapsed = session ? elapsedMs(session.startedAt, now) : 0;
  const canCancel = Boolean(session) && charge === 0 && itemsTotal === 0;

  const filtered = useMemo(() => {
    if (category === "all") return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  const addMut = useMutation({
    mutationFn: (productId: number) =>
      offlineAddItem(session!.id, productId, queryClient, online),
    onError: (err) => toast.error(err.message),
  });

  const bumpMut = useMutation({
    mutationFn: (input: { itemId: number; delta: 1 | -1 }) =>
      offlineBumpItem(input.itemId, input.delta, session!.id, queryClient, online),
    onError: (err) => toast.error(err.message),
  });

  const closeMut = useMutation({
    mutationFn: (payMethod: PayMethod) =>
      offlineCloseSession(session!.id, payMethod, table, now, queryClient, online),
    onSuccess: (data) => {
      setReceipt(data);
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => offlineCancelSession(session!.id, queryClient, online),
    onSuccess: () => {
      toast.success("Seans bekor qilindi");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!session) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-background/70"
        onClick={onClose}
        aria-label="Yopish"
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-surface sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-muted uppercase">
              {table.kind === "rus"
                ? "Rus piramidasi"
                : table.kind === "snooker"
                  ? "Snuker"
                  : "Amerikan"}
            </p>
            <h2 className="font-display text-2xl font-medium">{table.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5">
          <Stat label="Vaqt" value={formatElapsed(elapsed)} />
          <Stat label="Stol" value={formatSom(charge)} />
          <Stat label="Jami" value={formatSom(total)} />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Chek
          </p>
          {session.items.length === 0 ? (
            <p className="rounded-lg bg-background px-3 py-3 text-sm text-muted">
              Hali mahsulot yo‘q. Pastdan qo‘shing.
            </p>
          ) : (
            <ul className="space-y-1">
              {session.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.name}
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    {formatSom(item.unitPrice * item.qty)}
                  </span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                      onClick={() =>
                        bumpMut.mutate({ itemId: item.id, delta: -1 })
                      }
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                      onClick={() =>
                        bumpMut.mutate({ itemId: item.id, delta: 1 })
                      }
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Separator className="my-4" />

          <div className="mb-2 flex gap-1">
            {(
              [
                ["all", "Hammasi"],
                ["ichimlik", CATEGORY_LABEL.ichimlik],
                ["gazak", CATEGORY_LABEL.gazak],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                  category === key
                    ? "bg-foreground text-background"
                    : "bg-surface-2 text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addMut.mutate(product.id)}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/50"
              >
                <span className="text-sm">{product.name}</span>
                <span className="text-xs tabular-nums text-muted">
                  {formatSom(product.price)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
          {canCancel ? (
            <Button
              variant="outline"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
            >
              Bekor qilish
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Orqaga
            </Button>
          )}
          <Button onClick={() => setPayOpen(true)}>Yakunlash</Button>
        </div>
      </div>

      <Dialog
        open={payOpen || Boolean(receipt)}
        onOpenChange={(o) => {
          if (!o) {
            setPayOpen(false);
            if (receipt) {
              setReceipt(null);
              onClose();
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          {receipt ? (
            <>
              <DialogHeader>
                <DialogTitle>Chek</DialogTitle>
                <DialogDescription>Seans muvaffaqiyatli yopildi</DialogDescription>
              </DialogHeader>
              <ReceiptCard receipt={receipt} />
              <DialogFooter>
                <Button
                  className="w-full"
                  onClick={() => {
                    setReceipt(null);
                    setPayOpen(false);
                    onClose();
                  }}
                >
                  Tayyor
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>To‘lov turi</DialogTitle>
                <DialogDescription>
                  {table.name} · {formatSom(total)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {(["naqd", "karta"] as const).map((method) => (
                  <Button
                    key={method}
                    size="lg"
                    variant={method === "naqd" ? "default" : "secondary"}
                    disabled={closeMut.isPending}
                    onClick={() => closeMut.mutate(method)}
                  >
                    {PAY_LABEL[method]}
                  </Button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background px-3 py-2.5">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="font-mono text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
