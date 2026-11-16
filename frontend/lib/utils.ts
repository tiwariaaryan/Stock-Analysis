/**
 * Shared utility constants and functions used across multiple frontend components.
 *
 * Extracted from page.tsx, StockModal.tsx, and related files to eliminate
 * duplication of API base URL, number formatters, and user-ID resolution.
 */

/* ------------------------------------------------------------------ */
/*  API base URL                                                       */
/* ------------------------------------------------------------------ */

export const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Number formatters                                                  */
/* ------------------------------------------------------------------ */

/**
 * Format a number with 2 decimal places using Indian (en-IN) locale.
 * Returns "—" for null / undefined values.
 */
export function fmt(n: string | number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a large number into human-readable Indian financial shorthand
 * (T / Cr / L).  Prefixed with ₹.  Returns "—" for null / undefined.
 */
export function fmtBig(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ */
/*  User-ID helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective user ID from multiple sources:
 *   1. Provided `userId` (from ProfileProvider context)
 *   2. Provided `profileId` (profile.id from context)
 *   3. localStorage fallback (`investintel_profile`)
 *   4. Hard-coded default (2 — Aaryan Tiwari)
 *
 * The `defaultId` parameter lets callers override the fallback
 * (e.g. StockModal uses 1 instead of 2).
 */
export function getEffectiveUserId(
  userId?: number | null,
  profileId?: number | null,
  defaultId: number = 2,
): number {
  if (userId) return userId;
  if (profileId) return profileId;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("investintel_profile");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) return Number(parsed.id);
      }
    } catch {
      // ignore
    }
  }
  return defaultId;
}
