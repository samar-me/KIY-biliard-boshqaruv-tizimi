import { idbGet, idbSet } from "./idb";
import type {
  SyncQueueItem,
  SyncItem,
  OfflineSessionEntry,
  DirtySessionEntry,
} from "./types";

const QUEUE_KEY = "sync_queue:v1";

export async function getQueue(): Promise<SyncQueueItem[]> {
  return (await idbGet<SyncQueueItem[]>(QUEUE_KEY)) ?? [];
}

async function saveQueue(q: SyncQueueItem[]): Promise<void> {
  await idbSet(QUEUE_KEY, q);
}

export async function getPendingCount(): Promise<number> {
  return (await getQueue()).length;
}

export async function removeFromQueue(queueId: string): Promise<void> {
  const q = await getQueue();
  await saveQueue(q.filter((i) => i.queueId !== queueId));
}

// ── Offline sessions (localId < 0) ───────────────────────────────────────────

export async function enqueueOfflineSession(
  entry: Omit<OfflineSessionEntry, "queueId">,
): Promise<void> {
  const q = await getQueue();
  const queueId = crypto.randomUUID();
  await saveQueue([...q, { ...entry, queueId }]);
}

export async function updateOfflineSession(
  localId: number,
  updater: (e: OfflineSessionEntry) => OfflineSessionEntry,
): Promise<void> {
  const q = await getQueue();
  await saveQueue(
    q.map((item) =>
      item.type === "offlineSession" &&
      (item as OfflineSessionEntry).localId === localId
        ? updater(item as OfflineSessionEntry)
        : item,
    ),
  );
}

export async function removeOfflineSession(localId: number): Promise<void> {
  const q = await getQueue();
  await saveQueue(
    q.filter(
      (i) =>
        !(
          i.type === "offlineSession" &&
          (i as OfflineSessionEntry).localId === localId
        ),
    ),
  );
}

// ── Dirty sessions (real ticketId > 0, mutated while offline) ────────────────

export async function upsertDirtySession(
  ticketId: number,
  items: SyncItem[],
  closed?: DirtySessionEntry["closed"],
): Promise<void> {
  const q = await getQueue();
  const idx = q.findIndex(
    (i) =>
      i.type === "dirtySession" &&
      (i as DirtySessionEntry).ticketId === ticketId,
  );
  if (idx >= 0) {
    const existing = q[idx] as DirtySessionEntry;
    q[idx] = { ...existing, items, closed: closed ?? existing.closed };
    await saveQueue([...q]);
  } else {
    const queueId = crypto.randomUUID();
    await saveQueue([...q, { queueId, type: "dirtySession", ticketId, items, closed }]);
  }
}

export async function closeDirtySession(
  ticketId: number,
  items: SyncItem[],
  closed: NonNullable<DirtySessionEntry["closed"]>,
): Promise<void> {
  await upsertDirtySession(ticketId, items, closed);
}

// ── Bar checkouts ─────────────────────────────────────────────────────────────

export async function enqueueCheckoutBar(
  payMethod: string,
  lines: Array<{ productId: number; qty: number }>,
): Promise<void> {
  const q = await getQueue();
  const queueId = crypto.randomUUID();
  await saveQueue([
    ...q,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { queueId, type: "checkoutBar", payMethod: payMethod as any, lines },
  ]);
}
