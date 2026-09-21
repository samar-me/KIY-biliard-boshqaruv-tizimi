import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredPin, savePin, lockPin } from "@/lib/club/pin-auth";
import { getCatalog, saveProduct, saveTable } from "@/lib/club/api";

import {
  CATEGORY_LABEL,
  KIND_LABEL,
  PRODUCT_CATEGORIES,
  TABLE_KINDS,
  type CatalogTable,
  type Product,
  type ProductCategory,
  type TableKind,
} from "@/lib/club/types";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => getCatalog(),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
    queryClient.invalidateQueries({ queryKey: ["floor"] });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Klub</p>
        <h1 className="font-display text-3xl font-medium">Sozlamalar</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Stol narxlari va bar menyusi. O‘zgarishlar darhol zalga tushadi.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-medium">Stollar</h2>
        <ul className="space-y-2">
          {(data?.tables ?? []).map((table) => (
            <li key={table.id}>
              <TableEditor table={table} onSaved={refresh} />
            </li>
          ))}
        </ul>
        <NewTable onSaved={refresh} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-medium">Bar menyusi</h2>
        <ul className="space-y-2">
          {(data?.products ?? []).map((product) => (
            <li key={product.id}>
              <ProductEditor product={product} onSaved={refresh} />
            </li>
          ))}
        </ul>
        <NewProduct onSaved={refresh} />
      </section>

      <SecuritySection />
    </div>
  );
}


function TableEditor({
  table,
  onSaved,
}: {
  table: CatalogTable;
  onSaved: () => void;
}) {
  const [name, setName] = useState(table.name);
  const [kind, setKind] = useState<TableKind>(table.kind);
  const [rate, setRate] = useState(String(table.hourlyRate));
  const mut = useMutation({
    mutationFn: () =>
      saveTable({
        data: {
          id: table.id,
          name,
          kind,
          hourlyRate: Number(rate),
          active: table.active,
        },
      }),
    onSuccess: () => {
      toast.success("Stol saqlandi");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  const toggle = useMutation({
    mutationFn: () =>
      saveTable({
        data: {
          id: table.id,
          name: table.name,
          kind: table.kind,
          hourlyRate: table.hourlyRate,
          active: !table.active,
        },
      }),
    onSuccess: onSaved,
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[1fr_auto_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <Field label="Nomi">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Turi">
        <KindPills value={kind} onChange={setKind} />
      </Field>
      <Field label="Soatlik">
        <Input
          inputMode="numeric"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mut.isPending}>
          Saqlash
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => toggle.mutate()}
        >
          {table.active ? "Yashirish" : "Ko‘rsatish"}
        </Button>
      </div>
    </form>
  );
}

function NewTable({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TableKind>("pool");
  const [rate, setRate] = useState("20000");
  const mut = useMutation({
    mutationFn: () =>
      saveTable({
        data: { name, kind, hourlyRate: Number(rate), active: true },
      }),
    onSuccess: () => {
      toast.success("Stol qo‘shildi");
      setName("");
      setOpen(false);
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Stol qo‘shish
      </Button>
    );
  }
  return (
    <form
      className="grid gap-2 rounded-xl border border-dashed border-border bg-surface p-3 sm:grid-cols-[1fr_auto_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <Field label="Nomi">
        <Input
          autoFocus
          placeholder="Rus 4"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Turi">
        <KindPills value={kind} onChange={setKind} />
      </Field>
      <Field label="Soatlik">
        <Input
          inputMode="numeric"
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d]/g, ""))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mut.isPending || !name.trim()}>
          Qo‘shish
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Bekor
        </Button>
      </div>
    </form>
  );
}

function ProductEditor({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [price, setPrice] = useState(String(product.price));
  const mut = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          id: product.id,
          name,
          category,
          price: Number(price),
          active: product.active,
        },
      }),
    onSuccess: () => {
      toast.success("Mahsulot saqlandi");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  const toggle = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          active: !product.active,
        },
      }),
    onSuccess: onSaved,
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[1fr_auto_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <Field label="Nomi">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Bo‘lim">
        <CatPills value={category} onChange={setCategory} />
      </Field>
      <Field label="Narx">
        <Input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mut.isPending}>
          Saqlash
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => toggle.mutate()}
        >
          {product.active ? "Yashirish" : "Ko‘rsatish"}
        </Button>
      </div>
    </form>
  );
}

function NewProduct({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("ichimlik");
  const [price, setPrice] = useState("8000");
  const mut = useMutation({
    mutationFn: () =>
      saveProduct({
        data: { name, category, price: Number(price), active: true },
      }),
    onSuccess: () => {
      toast.success("Mahsulot qo‘shildi");
      setName("");
      setOpen(false);
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mahsulot qo‘shish
      </Button>
    );
  }
  return (
    <form
      className="grid gap-2 rounded-xl border border-dashed border-border bg-surface p-3 sm:grid-cols-[1fr_auto_7rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <Field label="Nomi">
        <Input
          autoFocus
          placeholder="Pepsi 0.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Bo‘lim">
        <CatPills value={category} onChange={setCategory} />
      </Field>
      <Field label="Narx">
        <Input
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mut.isPending || !name.trim()}>
          Qo‘shish
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Bekor
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function KindPills({
  value,
  onChange,
}: {
  value: TableKind;
  onChange: (v: TableKind) => void;
}) {
  return (
    <div className="flex h-11 items-center gap-1 rounded-lg bg-surface-2 p-1">
      {TABLE_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "h-9 rounded-md px-2.5 text-xs font-medium",
            value === k
              ? "bg-background text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function CatPills({
  value,
  onChange,
}: {
  value: ProductCategory;
  onChange: (v: ProductCategory) => void;
}) {
  return (
    <div className="flex h-11 items-center gap-1 rounded-lg bg-surface-2 p-1">
      {PRODUCT_CATEGORIES.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "h-9 rounded-md px-2.5 text-xs font-medium",
            value === k
              ? "bg-background text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {CATEGORY_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function SecuritySection() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (oldPin !== getStoredPin()) {
      toast.error("Hozirgi PIN-kod noto'g'ri kiritildi");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("Yangi PIN aniq 4 ta raqamdan iborat bo'lishi kerak");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Yangi PIN-kodlar mos kelmadi");
      return;
    }
    if (savePin(newPin)) {
      toast.success("PIN-kod muvaffaqiyatli yangilandi!");
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    }
  }

  function handleLock() {
    lockPin();
    toast.info("Admin paneli qulflandi");
    window.location.href = "/";
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-primary border border-border">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-medium">Xavfsizlik (PIN-kod)</h2>
            <p className="text-xs text-muted">
              Hisobot va sozlamalarni marker/ishchilardan himoyalash
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleLock} className="gap-2 text-xs">
          <Lock className="size-3.5" />
          Adminni qulflash
        </Button>
      </div>

      <form onSubmit={handleSavePin} className="mt-2 flex flex-col gap-3 max-w-md">
        <div>
          <label className="text-xs font-medium text-muted uppercase">
            Hozirgi PIN-kod
          </label>
          <Input
            type="password"
            maxLength={4}
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
            placeholder="••••"
            className="mt-1 font-mono tracking-widest text-center text-lg"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted uppercase">
              Yangi PIN (4 raqam)
            </label>
            <Input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
              className="mt-1 font-mono tracking-widest text-center text-lg"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted uppercase">
              Qayta kiriting
            </label>
            <Input
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="••••"
              className="mt-1 font-mono tracking-widest text-center text-lg"
              required
            />
          </div>
        </div>

        <Button type="submit" className="mt-2 w-full">
          Yangi PIN-kodni saqlash
        </Button>
      </form>
    </section>
  );
}

