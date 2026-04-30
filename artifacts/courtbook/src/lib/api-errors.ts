import { ApiError } from "@workspace/api-client-react";

export function extractApiError(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string; message?: string } | null;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  const anyErr = err as { message?: string; error?: string } | null | undefined;
  if (anyErr?.error) return anyErr.error;
  if (anyErr?.message) return anyErr.message;
  return fallback ?? "Įvyko klaida. Bandykite dar kartą.";
}
