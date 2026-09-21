import { useState, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Delete, Lock, ArrowLeft } from "lucide-react";
import { isPinUnlocked, verifyAndUnlock, DEFAULT_PIN, getStoredPin } from "@/lib/club/pin-auth";
import { cn } from "@/lib/utils";

export function PinGate({
  title = "Admin kirish",
  description = "Hisobot va sozlamalarni ko'rish uchun 4 xonali PIN-kodni kiriting",
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [errorShake, setErrorShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isPinUnlocked()) {
      setUnlocked(true);
    }
  }, []);

  function handleDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);

    if (next.length === 4) {
      if (verifyAndUnlock(next)) {
        setUnlocked(true);
      } else {
        setErrorShake(true);
        setTimeout(() => {
          setPin("");
          setErrorShake(false);
        }, 600);
      }
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
  }

  // Prevent SSR flash
  if (!mounted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  const isDefault = getStoredPin() === DEFAULT_PIN;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center px-4 py-8">
      {/* Icon & Title */}
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface border border-border shadow-sm">
        <Lock className="size-6 text-primary" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-medium tracking-tight text-center">
        {title}
      </h1>
      <p className="mt-1 max-w-xs text-center text-xs text-muted">
        {description}
      </p>

      {/* 4-digit dots indicator */}
      <div
        className={cn(
          "my-8 flex items-center justify-center gap-4 transition-transform duration-200",
          errorShake && "animate-shake text-destructive",
        )}
      >
        {[0, 1, 2, 3].map((idx) => {
          const filled = pin.length > idx;
          return (
            <span
              key={idx}
              className={cn(
                "size-4 rounded-full border-2 transition-all duration-150",
                filled
                  ? "border-primary bg-primary scale-110 shadow-[0_0_12px_rgba(61,143,98,0.5)]"
                  : "border-border bg-surface-2",
                errorShake && "border-destructive bg-destructive/20",
              )}
            />
          );
        })}
      </div>

      {/* Keypad Grid (3x4) */}
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="flex h-16 items-center justify-center rounded-2xl border border-border bg-surface font-display text-2xl font-medium text-foreground transition-all duration-100 active:scale-95 active:bg-surface-2"
          >
            {digit}
          </button>
        ))}
        {/* Bottom row: Back to floor, 0, Backspace */}
        <Link
          to="/"
          className="flex h-16 items-center justify-center rounded-2xl border border-border bg-surface/50 text-xs font-medium text-muted transition-all active:scale-95 hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="flex h-16 items-center justify-center rounded-2xl border border-border bg-surface font-display text-2xl font-medium text-foreground transition-all duration-100 active:scale-95 active:bg-surface-2"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="flex h-16 items-center justify-center rounded-2xl border border-border bg-surface/50 text-muted transition-all active:scale-95 hover:text-foreground"
          aria-label="O'chirish"
        >
          <Delete className="size-5" />
        </button>
      </div>

      {isDefault && (
        <p className="mt-6 text-center text-xs text-muted/60">
          Birlamchi PIN-kod: <span className="font-mono font-bold text-muted">7777</span>
        </p>
      )}
    </div>
  );
}
