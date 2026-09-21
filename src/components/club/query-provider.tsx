import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { syncEngine } from "@/lib/offline/engine";

export function ClubQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4_000,
            refetchOnWindowFocus: true,
            retry: (count, _err) => {
              // Don't retry when offline
              if (typeof navigator !== "undefined" && !navigator.onLine) return false;
              return count < 1;
            },
          },
        },
      }),
  );

  useEffect(() => {
    // Boot the sync engine (registers the 'online' listener)
    syncEngine.init();

    // Register Service Worker for offline PWA shell caching
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[SW] Registration error:", err);
      });
    }

    // When sync finishes, refetch fresh floor data from server
    function onSyncComplete() {
      client.invalidateQueries({ queryKey: ["floor"] });
    }
    window.addEventListener("kiy-sync-complete", onSyncComplete);
    return () => window.removeEventListener("kiy-sync-complete", onSyncComplete);
  }, [client]);


  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

