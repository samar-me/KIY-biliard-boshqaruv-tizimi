import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/club/settings-page";
import { PinGate } from "@/components/club/pin-gate";
import { getCatalog } from "@/lib/club/api";

export const Route = createFileRoute("/sozlamalar")({
  loader: () => getCatalog(),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <PinGate
      title="Sozlamalar"
      description="Klub narxlari va menyuni boshqarish uchun PIN-kodni kiriting"
    >
      <SettingsPage />
    </PinGate>
  );
}

