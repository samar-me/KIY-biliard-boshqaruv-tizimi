import { idbGet, idbSet } from "./idb";
import type { CachedFloor } from "./types";
import type { FloorPayload } from "@/lib/club/types";

const FLOOR_KEY = "floor_cache:v1";

/** In-memory L1 cache for instantaneous (0ms) synchronous reads. */
let _memFloor: FloorPayload | null = null;

/** Monotonically decreasing counter for temporary offline IDs. */
let _nextLocalId = -1;
export function nextLocalId(): number {
  return _nextLocalId--;
}

export function getMemoryFloor(): FloorPayload | null {
  return _memFloor;
}

export async function getCachedFloor(): Promise<FloorPayload | null> {
  if (_memFloor) return _memFloor;
  const cached = await idbGet<CachedFloor>(FLOOR_KEY);
  if (cached?.data) {
    _memFloor = cached.data;
    return cached.data;
  }
  return null;
}

export async function saveFloor(data: FloorPayload): Promise<void> {
  _memFloor = data;
  // Background persist to IndexedDB (non-blocking)
  idbSet(FLOOR_KEY, { data, savedAt: Date.now() } satisfies CachedFloor).catch(() => {});
}

