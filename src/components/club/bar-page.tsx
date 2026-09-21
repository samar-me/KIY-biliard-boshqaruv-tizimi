import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { ReceiptCard } from "@/components/club/receipt-card";
import { getFloor } from "@/lib/club/api";
import { useOnline } from "@/hooks/use-online";
import { offlineCheckoutBar } from "@/lib/club/offline-ops";
import { saveFloor } from "@/lib/offline/local-floor";
import { formatSom } from "@/lib/club/money";
import {
  CATEGORY_LABEL,
  PAY_LABEL,
  type PayMethod,
  type Product,
  type Receipt,
} from "@/lib/club/types";
import { cn } from "@/lib/utils";

type Line = { product: Product; qty: number };

export function BarPage() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["floor"],
    queryFn: async () => {
      const result = await getFloor();
      saveFloor(result).catch(() => {});
      return result;
    },
    refetchInterval: online ? 12_000 : false,
    refetchOnWindowFocus: online,
  });

  const products = data?.products ?? [];
  const [cart, setCart] = useState<Line[]>([]);
  const [filter, setFilter] = useState<"all" | Product["category"]>("all");
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") return products;
    return products.filter((p) => p.category === filter);
  }, [products, filter]);

  const total = cart.reduce((s, l) => s + l.product.price * l.qty, 0);

  function add(product: Product) {
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function bump(id: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === id ? { ...l, qty: l.qty + delta } : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  const checkoutMut = useMutation({
    mutationFn: (payMethod: PayMethod) =>
      offlineCheckoutBar(payMethod, cart, queryClient, online),
    onSuccess: (res) => {
      setPayOpen(false);
      setCart([]);
      setReceipt(res);
    },
    onError: (err) => toast.error(err.message),
  });


  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Kassa</p>
        <h1 className="font-display text-3xl font-medium">Bar</h1>
        <p className="mt-1 text-sm text-muted">
          Stolsiz savdo — choy, ichimlik, gazak.
        </p>
        <div className="mt-4 mb-3 flex gap-1">
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
              onClick={() => setFilter(key)}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm font-medium transition-colors",
                filter === key
                  ? "bg-foreground text-background"
                  : "bg-surface-2 text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => add(product)}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/50"
            >
              <span className="text-sm font-medium">{product.name}</span>
              <span className="text-xs tabular-nums text-muted">
                {formatSom(product.price)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="w-full shrink-0 rounded-2xl border border-border bg-surface p-4 lg:sticky lg:top-20 lg:w-80">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Savat</h2>
          {cart.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground"
              onClick={() => setCart([])}
            >
              Tozalash
            </button>
          ) : null}
        </div>
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Mahsulotni bosing — savatga tushadi.
          </p>
        ) : (
          <ul className="space-y-1">
            {cart.map((line) => (
              <li
                key={line.product.id}
                className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {line.product.name}
                </span>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                  onClick={() => bump(line.product.id, -1)}
                >
                  {line.qty === 1 ? (
                    <Trash2 className="size-3.5" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                </button>
                <span className="w-5 text-center text-sm tabular-nums">
                  {line.qty}
                </span>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
                  onClick={() => bump(line.product.id, 1)}
                >
                  <Plus className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted">Jami</span>
          <span className="font-display text-2xl font-medium tabular-nums">
            {formatSom(total)}
          </span>
        </div>
        <Button
          className="mt-3 w-full"
          size="lg"
          disabled={cart.length === 0}
          onClick={() => setPayOpen(true)}
        >
          To‘lash
        </Button>
      </aside>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bar to‘lovi</DialogTitle>
            <DialogDescription>{formatSom(total)}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(["naqd", "karta"] as const).map((method) => (
              <Button
                key={method}
                size="lg"
                variant={method === "naqd" ? "default" : "secondary"}
                disabled={checkoutMut.isPending}
                onClick={() => checkoutMut.mutate(method)}
              >
                {PAY_LABEL[method]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chek</DialogTitle>
            <DialogDescription>Savdo yozildi.</DialogDescription>
          </DialogHeader>
          {receipt ? <ReceiptCard receipt={receipt} /> : null}
          <DialogFooter>
            <Button className="w-full" onClick={() => setReceipt(null)}>
              Tayyor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
