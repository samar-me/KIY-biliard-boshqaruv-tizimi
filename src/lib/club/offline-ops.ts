/**
 * Offline-aware wrappers for every club mutation.
 *
 * Strategy:
 *   • Online + real server ID  → hit the server, then invalidate React Query.
 *   • Offline + local ID (< 0) → update local state + queue as offlineSession.
 *   • Offline + real ID (> 0)  → update local state + queue as dirtySession.
 *
 * All functions update the React Query cache and IndexedDB in sync so the UI
 * is always backed by the latest local state, with no flash on refetch.
 */

import type { QueryClient } from "@tanstack/react-query";
import {
  addItem,
  bumpItem,
  closeSession,
  cancelSession,
  checkoutBar,
  startSession,
} from "@/lib/club/api";
import {
  elapsedMs,
  formatElapsed,
  timeCharge,
} from "@/lib/club/money";
import type {
  FloorPayload,
  FloorTable,
  PayMethod,
  Receipt,
  TicketItem,
} from "@/lib/club/types";
import { nextLocalId, saveFloor } from "@/lib/offline/local-floor";
import {
  enqueueOfflineSession,
  updateOfflineSession,
  removeOfflineSession,
  upsertDirtySession,
  closeDirtySession,
  enqueueCheckoutBar,
} from "@/lib/offline/queue";
import type { SyncItem } from "@/lib/offline/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function setFloor(qc: QueryClient, data: FloorPayload): void {
  qc.setQueryData(["floor"], data);
}

function getFloorData(qc: QueryClient): FloorPayload | undefined {
  return qc.getQueryData<FloorPayload>(["floor"]);
}

function sessionItems(floor: FloorPayload, ticketId: number): SyncItem[] {
  const t = floor.tables.find((t) => t.session?.id === ticketId);
  return (t?.session?.items ?? []).map((i) => ({
    productId: i.productId,
    name: i.name,
    unitPrice: i.unitPrice,
    qty: i.qty,
  }));
}

// ── startSession ───────────────────────────────────────────────────────────────

export async function offlineStartSession(
  tableId: number,
  qc: QueryClient,
  online: boolean,
): Promise<void> {
  if (online) {
    await startSession({ data: { tableId } });
    qc.invalidateQueries({ queryKey: ["floor"] });
    return;
  }

  const floor = getFloorData(qc);
  if (!floor) throw new Error("Ma'lumot yuklanmagan — internetga uling");

  const table = floor.tables.find((t) => t.id === tableId);
  if (!table) throw new Error("Stol topilmadi");
  if (table.session) throw new Error("Bu stol allaqachon band");

  const localId = nextLocalId();
  const startedAt = new Date().toISOString();

  const updated: FloorPayload = {
    ...floor,
    tables: floor.tables.map((t) =>
      t.id === tableId
        ? {
            ...t,
            session: {
              id: localId,
              startedAt,
              hourlyRate: t.hourlyRate,
              items: [],
            },
          }
        : t,
    ),
  };

  setFloor(qc, updated);
  await saveFloor(updated);
  await enqueueOfflineSession({
    type: "offlineSession",
    localId,
    tableId,
    tableName: table.name,
    startedAt,
    hourlyRate: table.hourlyRate,
    items: [],
  });
}

// ── addItem ────────────────────────────────────────────────────────────────────

export async function offlineAddItem(
  ticketId: number,
  productId: number,
  qc: QueryClient,
  online: boolean,
): Promise<void> {
  if (online && ticketId > 0) {
    await addItem({ data: { ticketId, productId } });
    qc.invalidateQueries({ queryKey: ["floor"] });
    return;
  }

  const floor = getFloorData(qc);
  if (!floor) throw new Error("Ma'lumot yuklanmagan");

  const product = floor.products.find((p) => p.id === productId);
  if (!product) throw new Error("Mahsulot topilmadi");

  const localItemId = nextLocalId(); // used only if item is new (not existing)

  const updated: FloorPayload = {
    ...floor,
    tables: floor.tables.map((t) => {
      if (!t.session || t.session.id !== ticketId) return t;
      const existing = t.session.items.find((i) => i.productId === productId);
      const newItems: TicketItem[] = existing
        ? t.session.items.map((i) =>
            i.productId === productId ? { ...i, qty: i.qty + 1 } : i,
          )
        : [
            ...t.session.items,
            {
              id: localItemId,
              productId,
              name: product.name,
              unitPrice: product.price,
              qty: 1,
            },
          ];
      return { ...t, session: { ...t.session, items: newItems } };
    }),
  };

  setFloor(qc, updated);
  await saveFloor(updated);

  const currentItems = sessionItems(updated, ticketId);
  if (ticketId < 0) {
    await updateOfflineSession(ticketId, (e) => ({ ...e, items: currentItems }));
  } else {
    await upsertDirtySession(ticketId, currentItems);
  }
}

// ── bumpItem ───────────────────────────────────────────────────────────────────

export async function offlineBumpItem(
  itemId: number,
  delta: 1 | -1,
  ticketId: number,
  qc: QueryClient,
  online: boolean,
): Promise<void> {
  if (online && ticketId > 0) {
    await bumpItem({ data: { itemId, delta } });
    qc.invalidateQueries({ queryKey: ["floor"] });
    return;
  }

  const floor = getFloorData(qc);
  if (!floor) throw new Error("Ma'lumot yuklanmagan");

  const updated: FloorPayload = {
    ...floor,
    tables: floor.tables.map((t) => {
      if (!t.session || t.session.id !== ticketId) return t;
      const newItems = t.session.items
        .map((i) => (i.id === itemId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      return { ...t, session: { ...t.session, items: newItems } };
    }),
  };

  setFloor(qc, updated);
  await saveFloor(updated);

  const currentItems = sessionItems(updated, ticketId);
  if (ticketId < 0) {
    await updateOfflineSession(ticketId, (e) => ({ ...e, items: currentItems }));
  } else {
    await upsertDirtySession(ticketId, currentItems);
  }
}

// ── closeSession ───────────────────────────────────────────────────────────────

export async function offlineCloseSession(
  ticketId: number,
  payMethod: PayMethod,
  table: FloorTable,
  now: number,
  qc: QueryClient,
  online: boolean,
): Promise<Receipt> {
  if (online && ticketId > 0) {
    try {
      const receipt = await closeSession({ data: { ticketId, payMethod } });
      qc.invalidateQueries({ queryKey: ["floor"] });
      return receipt;
    } catch (err) {
      console.warn("[offline-ops] Online closeSession failed, falling back to offline:", err);
    }
  }


  const session = table.session;
  if (!session) throw new Error("Seans topilmadi");

  const endedAt = new Date(now).toISOString();
  const charge = timeCharge(session.hourlyRate, session.startedAt, now);
  const itemsTotal = session.items.reduce(
    (s, i) => s + i.unitPrice * i.qty,
    0,
  );
  const total = charge + itemsTotal;

  const floor = getFloorData(qc);
  if (!floor) throw new Error("Ma'lumot yuklanmagan");

  const updated: FloorPayload = {
    ...floor,
    todayClosedTotal: floor.todayClosedTotal + total,
    tables: floor.tables.map((t) =>
      t.session?.id === ticketId ? { ...t, session: null } : t,
    ),
  };

  setFloor(qc, updated);
  await saveFloor(updated);

  const closedInfo = { endedAt, payMethod, timeCharge: charge, itemsTotal, total };

  if (ticketId < 0) {
    await updateOfflineSession(ticketId, (e) => ({ ...e, closed: closedInfo }));
  } else {
    const items = session.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: i.unitPrice,
      qty: i.qty,
    }));
    await closeDirtySession(ticketId, items, closedInfo);
  }

  return {
    id: ticketId,
    tableName: table.name,
    kind: "table",
    startedAt: session.startedAt,
    endedAt,
    elapsedLabel: formatElapsed(elapsedMs(session.startedAt, now)),
    hourlyRate: session.hourlyRate,
    timeCharge: charge,
    items: session.items,
    itemsTotal,
    total,
    payMethod,
  };
}

// ── cancelSession ──────────────────────────────────────────────────────────────

export async function offlineCancelSession(
  ticketId: number,
  qc: QueryClient,
  online: boolean,
): Promise<void> {
  if (online && ticketId > 0) {
    await cancelSession({ data: { ticketId } });
    qc.invalidateQueries({ queryKey: ["floor"] });
    return;
  }

  const floor = getFloorData(qc);
  if (!floor) throw new Error("Ma'lumot yuklanmagan");

  const updated: FloorPayload = {
    ...floor,
    tables: floor.tables.map((t) =>
      t.session?.id === ticketId ? { ...t, session: null } : t,
    ),
  };

  setFloor(qc, updated);
  await saveFloor(updated);

  if (ticketId < 0) {
    await removeOfflineSession(ticketId);
  }
  // For dirty sessions (ticketId > 0), the server still has them open;
  // we'll leave them — they'll be cleaned up on next floor refetch.
}

// ── checkoutBar ────────────────────────────────────────────────────────────────

type BarLine = { product: { id: number; name: string; price: number }; qty: number };

export async function offlineCheckoutBar(
  payMethod: PayMethod,
  lines: BarLine[],
  qc: QueryClient,
  online: boolean,
): Promise<Receipt> {
  const nowIso = new Date().toISOString();
  const items: TicketItem[] = lines.map((l, idx) => ({
    id: -(idx + 1),
    productId: l.product.id,
    name: l.product.name,
    unitPrice: l.product.price,
    qty: l.qty,
  }));
  const itemsTotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

  const receipt: Receipt = {
    id: nextLocalId(),
    tableName: null,
    kind: "bar",
    startedAt: nowIso,
    endedAt: nowIso,
    elapsedLabel: "00:00:00",
    hourlyRate: 0,
    timeCharge: 0,
    items,
    itemsTotal,
    total: itemsTotal,
    payMethod,
  };

  if (online) {
    try {
      const serverReceipt = await checkoutBar({
        data: {
          payMethod,
          lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
        },
      });
      qc.invalidateQueries({ queryKey: ["floor"] });
      qc.invalidateQueries({ queryKey: ["report"] });
      return serverReceipt;
    } catch (err) {
      console.warn("[offline-ops] Online checkoutBar failed, falling back to offline:", err);
    }
  }


  // Offline: update today total locally and queue
  const floor = getFloorData(qc);
  if (floor) {
    const updated = {
      ...floor,
      todayClosedTotal: floor.todayClosedTotal + itemsTotal,
    };
    setFloor(qc, updated);
    await saveFloor(updated);
  }
  await enqueueCheckoutBar(
    payMethod,
    lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
  );

  return receipt;
}
