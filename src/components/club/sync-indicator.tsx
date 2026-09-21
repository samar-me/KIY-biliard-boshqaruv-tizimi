import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { useSyncState } from "@/hooks/use-sync-state";

/**
 * Small pill shown in the header.
 * Hidden when everything is online and idle (normal operation).
 */
export function SyncIndicator() {
  const online = useOnline();
  const sync = useSyncState();

  // Sync running
  if (sync.status === "syncing") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-400">
        <RefreshCw className="size-3 animate-spin" />
        <span>Sinxronlanmoqda…</span>
      </div>
    );
  }

  // Sync error
  if (sync.status === "error") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400">
        <AlertTriangle className="size-3" />
        <span>Sync xatosi</span>
      </div>
    );
  }

  // Offline (with or without pending ops)
  if (!online) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">
        <WifiOff className="size-3" />
        <span>
          Offline{sync.pending > 0 ? ` · ${sync.pending} ta kutmoqda` : ""}
        </span>
      </div>
    );
  }

  // Online + pending ops waiting (just came back)
  if (sync.pending > 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">
        <RefreshCw className="size-3" />
        <span>{sync.pending} ta yuborilmoqda</span>
      </div>
    );
  }

  // All good — don't render anything
  return null;
}
