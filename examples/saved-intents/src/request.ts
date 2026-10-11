export async function request<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.ok) return (await response.json()) as T;
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    // Proxies and empty error responses may not provide a JSON Problem body.
  }
  const code =
    value &&
    typeof value === "object" &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code.trim().length > 0
      ? value.code
      : response.status === 403
        ? "saved-intent/denied"
        : response.status === 409
          ? "saved-intent/conflict"
          : response.status === 400
            ? "saved-intent/invalid"
            : "SAVED_REQUEST_FAILED";
  throw Object.assign(new Error(code), { code, status: response.status });
}
