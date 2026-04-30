/**
 * Shared frontend form validators for email and phone fields.
 * Mirrors the backend rules in `@workspace/api-zod`.
 *
 * All messages are in Lithuanian so they can be shown directly to users.
 *
 * Each validator returns an error string when invalid, or null when OK.
 * Callers can pass `{ required: false }` to allow empty values.
 */

const PHONE_DIGIT_RE = /^\+?\d{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidatorOpts {
  required?: boolean;
}

export function validateEmail(raw: unknown, opts: ValidatorOpts = {}): string | null {
  const required = opts.required ?? true;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return required ? "Įveskite el. paštą" : null;
  if (!EMAIL_RE.test(value)) return "Neteisingas el. paštas";
  return null;
}

export function normalizePhone(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  return value.replace(/[\s\-().]/g, "").trim();
}

export function validatePhone(raw: unknown, opts: ValidatorOpts = {}): string | null {
  const required = opts.required ?? true;
  const normalized = normalizePhone(raw);
  if (!normalized) return required ? "Įveskite telefono numerį" : null;
  if (!PHONE_DIGIT_RE.test(normalized)) return "Neteisingas telefono numeris";
  return null;
}
