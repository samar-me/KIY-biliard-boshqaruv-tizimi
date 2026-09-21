/**
 * PIN-code protection for Admin areas (Hisobot and Sozlamalar).
 * Default PIN: 7777.
 * Unlocked state is stored in sessionStorage so it resets when browser/tab is closed.
 */

const PIN_STORAGE_KEY = "kiy_admin_pin";
const UNLOCKED_KEY = "kiy_pin_unlocked";
export const DEFAULT_PIN = "7777";

export function getStoredPin(): string {
  if (typeof window === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
}

export function savePin(newPin: string): boolean {
  if (!/^\d{4}$/.test(newPin)) return false;
  localStorage.setItem(PIN_STORAGE_KEY, newPin);
  return true;
}

export function isPinUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCKED_KEY) === "true";
}

export function verifyAndUnlock(pin: string): boolean {
  if (pin === getStoredPin()) {
    sessionStorage.setItem(UNLOCKED_KEY, "true");
    return true;
  }
  return false;
}

export function lockPin(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(UNLOCKED_KEY);
}
