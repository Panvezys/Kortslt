import { z } from "zod";

/**
 * Shared zod validators for contact fields.
 *
 * Email: trims surrounding whitespace, then runs zod's RFC-style email check.
 *
 * Phone: permissive Lithuanian-friendly validator. The user can paste numbers
 * with spaces, dashes, parens or dots — we normalize before checking. The
 * accepted shapes are:
 *   • +<7-15 digits>            (international)
 *   • <8-15 digits>             (national, e.g. "861234567" or "8 612 34 567")
 * Anything shorter than 7 significant digits is rejected because it cannot
 * possibly be a real number.
 *
 * Lithuanian error messages so they surface verbatim to end users.
 */

const PHONE_DIGIT_RE = /^\+?\d{7,15}$/;

function normalizePhone(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

export const EmailString = z
  .string({
    required_error: "Įveskite el. paštą",
    invalid_type_error: "Įveskite el. paštą",
  })
  .trim()
  .min(1, "Įveskite el. paštą")
  .email("Neteisingas el. paštas");

export const OptionalEmailString = z
  .string()
  .trim()
  .email("Neteisingas el. paštas")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const PhoneString = z
  .string()
  .trim()
  .min(1, "Įveskite telefono numerį")
  .transform(normalizePhone)
  .refine((v) => PHONE_DIGIT_RE.test(v), "Neteisingas telefono numeris");

export const OptionalPhoneString = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((v) => v === "" || PHONE_DIGIT_RE.test(v), "Neteisingas telefono numeris")
  .transform((v) => (v === "" ? undefined : v))
  .optional();
