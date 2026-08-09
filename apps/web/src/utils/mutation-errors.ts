/**
 * Turn a tRPC/React Query mutation error into a message a user can act on.
 *
 * Zod input-validation failures arrive as error.message set to a JSON array
 * of issues (e.g. `[{"message":"Volume after filtering...","path":[...]}]`),
 * which reads as a wall of JSON — or worse, gets dropped entirely by forms
 * without an onError handler. This extracts the human-written issue messages.
 */
export function humanizeMutationError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  try {
    const issues = JSON.parse(message);
    if (Array.isArray(issues)) {
      const msgs = issues
        .map((i) => (i && typeof i.message === "string" ? i.message : null))
        .filter(Boolean);
      if (msgs.length > 0) return msgs.join("\n");
    }
  } catch {
    // not JSON — use as-is
  }
  return message;
}
