// Fixture-only rendezvous. Miniflare intercepts this fetch locally; no external service is used.
export async function waitForOverlappingRequests(request: Request): Promise<void> {
  if (request.headers.get("x-overlap") === "four-requests") {
    await fetch("https://request-overlap.invalid/rendezvous");
  }
}
