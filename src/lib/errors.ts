/** Extracts the API's `{ error }` message from an axios-style error. */
export function getApiError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const res = (err as { response?: { data?: { error?: string } } }).response;
    if (res?.data?.error) return res.data.error;
    if ("request" in err && !res) return "Can't reach the server. Check your connection.";
  }
  return fallback;
}
