import type { NormalizedWebhookHeaders, WebhookHeaders } from "./types";

export function normalizeWebhookHeaders(headers: WebhookHeaders): NormalizedWebhookHeaders {
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    const normalizedName = name.trim().toLowerCase();
    if (normalizedName.length === 0) {
      continue;
    }

    normalized[normalizedName] = typeof value === "string" ? value : value.join(", ");
  }

  return normalized;
}
