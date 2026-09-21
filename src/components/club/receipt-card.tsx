import { Printer } from "lucide-react";
import { PAY_LABEL, type Receipt } from "@/lib/club/types";
import { formatSom } from "@/lib/club/money";
import { Separator } from "@/components/ui/separator";


export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const ended = new Date(receipt.endedAt);
  const when = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ended);

  return (
    <div className="rounded-xl border border-border bg-background px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-medium">KIY</p>
        <p className="text-xs text-muted tabular-nums">#{receipt.id}</p>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {receipt.tableName ?? "Bar"} · {when}
      </p>
      <Separator className="my-3" />
      {receipt.kind === "table" ? (
        <Row
          label={`Vaqt ${receipt.elapsedLabel}`}
          value={formatSom(receipt.timeCharge)}
        />
      ) : null}
      {receipt.items.map((item) => (
        <Row
          key={item.id}
          label={`${item.name} × ${item.qty}`}
          value={formatSom(item.unitPrice * item.qty)}
        />
      ))}
      <Separator className="my-3" />
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Jami</span>
        <span className="font-display text-2xl font-medium tabular-nums">
          {formatSom(receipt.total)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <p className="text-xs text-muted uppercase tracking-wider">{PAY_LABEL[receipt.payMethod]}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface active:scale-95 print:hidden"
        >
          <Printer className="size-3.5" />
          Chop etish
        </button>
      </div>
    </div>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
