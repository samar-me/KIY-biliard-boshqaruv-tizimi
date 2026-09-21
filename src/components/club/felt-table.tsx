import { memo } from "react";
import { cn } from "@/lib/utils";

export const FeltTable = memo(function FeltTable({ occupied }: { occupied: boolean }) {

  return (
    <div
      className="rounded-xl bg-rail p-1.5"
      style={{ boxShadow: "var(--shadow-border)" }}
    >
      <div
        className={cn(
          "relative aspect-[16/9] overflow-hidden rounded-lg transition-colors duration-300",
          occupied ? "felt-bed-lit" : "felt-bed",
        )}
      >
        <span className="pocket top-0.5 left-0.5" />
        <span className="pocket top-0.5 right-0.5" />
        <span className="pocket bottom-0.5 left-0.5" />
        <span className="pocket bottom-0.5 right-0.5" />
        <span className="pocket top-1/2 left-0.5 -translate-y-1/2" />
        <span className="pocket top-1/2 right-0.5 -translate-y-1/2" />
        {occupied ? <span className="cue-ball" /> : null}
      </div>
    </div>
  );
});

