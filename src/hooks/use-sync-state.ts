import { useSyncExternalStore } from "react";
import { syncEngine } from "@/lib/offline/engine";
import type { SyncState } from "@/lib/offline/types";

/** Returns the current sync engine state, updates reactively. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => syncEngine.subscribe(() => cb()),
    () => syncEngine.getState(),
    () => ({ status: "idle" as const, pending: 0 }),
  );
}
