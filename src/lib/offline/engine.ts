/**
 * SyncEngine — singleton that listens for the `online` event and
 * processes the pending queue in FIFO order.
 *
 * Emits SyncState to all subscribers and dispatches the custom
 * "kiy-sync-complete" DOM event when finished so UI layers can refetch.
 */

import { getQueue, removeFromQueue, removeOfflineSession } from "./queue";
import { getCachedFloor, saveFloor } from "./local-floor";
import type { SyncQueueItem, SyncState, OfflineSessionEntry, DirtySessionEntry } from "./types";

type Listener = (s: SyncState) => void;

class SyncEngine {
  private _state: SyncState = { status: "idle", pending: 0 };
  private _listeners = new Set<Listener>();
  private _running = false;

  /** Call once from a client-only provider to register the online listener. */
  init(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => void this.sync());
  }

  getState(): SyncState {
    return this._state;
  }

  subscribe(cb: Listener): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  private emit(s: SyncState): void {
    this._state = s;
    for (const l of this._listeners) l(s);
  }

  /** Trigger sync manually (e.g., on app resume). */
  async sync(): Promise<void> {
    if (
      this._running ||
      typeof navigator === "undefined" ||
      !navigator.onLine
    )
      return;

    const queue = await getQueue();
    if (queue.length === 0) return;

    this._running = true;
    this.emit({ status: "syncing", pending: queue.length });

    try {
      for (const item of queue) {
        await this._process(item);
        const remaining = (await getQueue()).length;
        this.emit({ status: "syncing", pending: remaining });
      }
      this.emit({ status: "idle", pending: 0 });
      // Signal UI layers to refetch fresh data from server
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("kiy-sync-complete"));
      }
    } catch (err) {
      const error =
        err instanceof Error ? err.message : "Noma'lum sync xatosi";
      const remaining = (await getQueue()).length;
      this.emit({ status: "error", pending: remaining, error });
    } finally {
      this._running = false;
    }
  }

  private async _process(item: SyncQueueItem): Promise<void> {
    // Lazy import to avoid circular deps and bundle issues
    const api = await import("@/lib/club/api");

    if (item.type === "offlineSession") {
      const s = item as OfflineSessionEntry;

      if (s.closed) {
        // Fully offline session — write the closed record to server
        await api.syncClosedSession({
          data: {
            tableId: s.tableId,
            startedAt: s.startedAt,
            endedAt: s.closed.endedAt,
            hourlyRate: s.hourlyRate,
            timeCharge: s.closed.timeCharge,
            itemsTotal: s.closed.itemsTotal,
            total: s.closed.total,
            payMethod: s.closed.payMethod,
            items: s.items,
          },
        });
        await removeOfflineSession(s.localId);
      } else {
        // Offline session still open — create it on the server and update localId
        const res = await api.syncOpenSession({
          data: {
            tableId: s.tableId,
            startedAt: s.startedAt,
            hourlyRate: s.hourlyRate,
            items: s.items,
          },
        });
        // Patch the persisted floor cache (IndexedDB) so the session now has its real ID
        const floor = await getCachedFloor();
        if (floor) {
          const updated = {
            ...floor,
            tables: floor.tables.map((t) =>
              t.session?.id === s.localId
                ? { ...t, session: { ...t.session!, id: res.ticketId } }
                : t,
            ),
          };
          await saveFloor(updated);
        }
        await removeOfflineSession(s.localId);
      }
    } else if (item.type === "dirtySession") {
      const s = item as DirtySessionEntry;

      if (s.closed) {
        // Session was closed while offline — force the server to use our final state
        await api.forceCloseSession({
          data: {
            ticketId: s.ticketId,
            payMethod: s.closed.payMethod,
            endedAt: s.closed.endedAt,
            timeCharge: s.closed.timeCharge,
            itemsTotal: s.closed.itemsTotal,
            total: s.closed.total,
            items: s.items,
          },
        });
      } else {
        // Session is still open — push the latest item state to server
        await api.syncDirtySessionItems({
          data: { ticketId: s.ticketId, items: s.items },
        });
      }
      await removeFromQueue(s.queueId);
    } else if (item.type === "checkoutBar") {
      await api.checkoutBar({
        data: { payMethod: item.payMethod, lines: item.lines },
      });
      await removeFromQueue(item.queueId);
    }
  }
}

export const syncEngine = new SyncEngine();
