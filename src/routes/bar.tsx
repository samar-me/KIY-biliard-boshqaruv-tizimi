import { createFileRoute } from "@tanstack/react-router";
import { BarPage } from "@/components/club/bar-page";
import { getFloor } from "@/lib/club/api";

export const Route = createFileRoute("/bar")({
  loader: () => getFloor(),
  component: BarRoute,
});

function BarRoute() {
  return <BarPage />;
}
