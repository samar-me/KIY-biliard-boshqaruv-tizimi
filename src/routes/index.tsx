import { createFileRoute } from "@tanstack/react-router";
import { FloorPage } from "@/components/club/floor-page";
import { getFloor } from "@/lib/club/api";
import { getCachedFloor, saveFloor } from "@/lib/offline/local-floor";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const data = await getFloor();
      // Persist to IndexedDB for offline use (client-side only)
      if (typeof indexedDB !== "undefined") {
        saveFloor(data).catch(() => {});
      }
      return data;
    } catch {
      // Offline or server error → try IndexedDB cache
      if (typeof indexedDB !== "undefined") {
        const cached = await getCachedFloor();
        if (cached) return cached;
      }
      throw new Error(
        "Internet yo'q va kesh bo'sh. Internetga uling va qayta oching.",
      );
    }
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <FloorPage initial={initial} />;
}

