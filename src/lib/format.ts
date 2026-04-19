/** Safely convert any value to number; returns 0 for empty/NaN. */
export function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : 0;
}

/** Validate Indian 10-digit mobile. Returns sanitized digits or null. */
export function sanitizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** Build a wa.me URL only when the mobile is valid; null otherwise. */
export function buildWhatsappUrl(mobile: string, message: string): string | null {
  const m = sanitizeMobile(mobile);
  if (!m) return null;
  return `https://wa.me/91${m}?text=${encodeURIComponent(message)}`;
}

/** Format INR with grouping. */
export function inr(n: number): string {
  return `₹${(safeNum(n)).toLocaleString("en-IN")}`;
}

/** Compute the next due-date description based on day-of-month. */
export function nextDueLabel(dueDay: number): string {
  const today = new Date();
  const day = today.getDate();
  const target = Math.max(1, Math.min(28, dueDay || 1));
  if (day <= target) {
    return `${target}${ordinalSuffix(target)} of this month`;
  }
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthName = next.toLocaleString("en-IN", { month: "long" });
  return `${target}${ordinalSuffix(target)} ${monthName}`;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
