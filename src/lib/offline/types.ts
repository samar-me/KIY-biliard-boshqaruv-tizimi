import type { FloorPayload, PayMethod } from "@/lib/club/types";

// ── Shared ───────────────────────────────────────────────────────────────────

/** One item as stored in the sync queue (no local item ID needed). */
export type SyncItem = {
  productId: number | null;
  name: string;
  unitPrice: number;
  qty: number;
};


// ── Queue entries ─────────────────────────────────────────────────────────────

/**
 * A session that started while offline (localId < 0).
 * `closed` is filled when the session is finished while still offline.
 * When online: if `closed` → syncClosedSession; else → syncOpenSession.
 */
export type OfflineSessionEntry = {
  queueId: string;
  type: "offlineSession";
  localId: number; // always negative
  tableId: number;
  tableName: string;
  startedAt: string;
  hourlyRate: number;
  items: SyncItem[];
  closed?: {
    endedAt: string;
    payMethod: PayMethod;
    timeCharge: number;
    itemsTotal: number;
    total: number;
  };
};

/**
 * An online session (positive ticketId) that received mutations while offline.
 * When online: if `closed` → forceCloseSession; else → syncDirtySessionItems.
 */
export type DirtySessionEntry = {
  queueId: string;
  type: "dirtySession";
  ticketId: number; // real server ID > 0
  items: SyncItem[];
  closed?: {
    endedAt: string;
    payMethod: PayMethod;
    timeCharge: number;
    itemsTotal: number;
    total: number;
  };
};

/** Bar-only checkout performed while offline. */
export type CheckoutBarEntry = {
  queueId: string;
  type: "checkoutBar";
  payMethod: PayMethod;
  lines: Array<{ productId: number; qty: number }>;
};

export type SyncQueueItem =
  | OfflineSessionEntry
  | DirtySessionEntry
  | CheckoutBarEntry;

// ── Engine state ──────────────────────────────────────────────────────────────

export type SyncStatus = "idle" | "syncing" | "error";

export type SyncState = {
  status: SyncStatus;
  pending: number;
  error?: string;
};

// ── Floor cache ───────────────────────────────────────────────────────────────

export type CachedFloor = {
  data: FloorPayload;
  savedAt: number;
};
