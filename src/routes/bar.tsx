import { createFileRoute } from "@tanstack/react-router";
import { BarPage } from "@/components/club/bar-page";
import { getFloor } from "@/lib/club/api";
import { getCachedFloor, saveFloor } from "@/lib/offline/local-floor";

export const Route = createFileRoute("/bar")({
  loader: async () => {
    try {
      const data = await getFloor();
      if (typeof indexedDB !== "undefined") {
        saveFloor(data).catch(() => {});
      }
      return data;
    } catch {
      if (typeof indexedDB !== "undefined") {
        const cached = await getCachedFloor();
        if (cached) return cached;
      }
      return null;
    }
  },
  component: BarRoute,
});

function BarRoute() {
  return <BarPage />;
}

