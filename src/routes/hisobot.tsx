import { createFileRoute } from "@tanstack/react-router";
import { ReportPage } from "@/components/club/report-page";
import { PinGate } from "@/components/club/pin-gate";

export const Route = createFileRoute("/hisobot")({
  component: ReportRoute,
});

function ReportRoute() {
  return (
    <PinGate
      title="Hisobot"
      description="Kassa va tushumlarni ko'rish uchun PIN-kodni kiriting"
    >
      <ReportPage />
    </PinGate>
  );
}

