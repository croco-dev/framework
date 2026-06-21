import { InvalidWebhookFixtureProblem } from "./problems/WebhookProblems";
import type { WebhookGatewayReplayFixture, WebhookHeaders } from "./types";

type EncodedWebhookReplayFixture = {
  readonly provider: string;
  readonly rawBody: string;
  readonly headers: WebhookHeaders;
  readonly name?: string;
  readonly eventId?: string;
  readonly eventType?: string;
  readonly receivedAt?: string;
  readonly metadata?: Record<string, unknown>;
};

export function createWebhookReplayFixture(
  fixture: WebhookGatewayReplayFixture,
): WebhookGatewayReplayFixture {
  return {
    ...fixture,
    headers: { ...fixture.headers },
  };
}

export function parseWebhookReplayFixture(source: string | unknown): WebhookGatewayReplayFixture {
  const value = typeof source === "string" ? parseFixtureJson(source) : source;
  if (!isRecord(value)) {
    throw new InvalidWebhookFixtureProblem("fixture must be an object");
  }

  const provider = readString(value, "provider");
  const rawBody = readString(value, "rawBody");
  const headers = readHeaders(value.headers);
  const receivedAt = readOptionalDate(value.receivedAt);
  const metadata = readOptionalRecord(value.metadata, "metadata");

  return createWebhookReplayFixture({
    provider,
    rawBody,
    headers,
    ...(readOptionalString(value.name, "name") === undefined
      ? {}
      : { name: readOptionalString(value.name, "name") }),
    ...(readOptionalString(value.eventId, "eventId") === undefined
      ? {}
      : { eventId: readOptionalString(value.eventId, "eventId") }),
    ...(readOptionalString(value.eventType, "eventType") === undefined
      ? {}
      : { eventType: readOptionalString(value.eventType, "eventType") }),
    ...(receivedAt === undefined ? {} : { receivedAt }),
    ...(metadata === undefined ? {} : { metadata }),
  });
}

export async function loadWebhookReplayFixture(
  filePath: string,
): Promise<WebhookGatewayReplayFixture> {
  const fs = await import("node:fs/promises");
  const content = await fs.readFile(filePath, "utf-8");
  return parseWebhookReplayFixture(content);
}

function parseFixtureJson(source: string): EncodedWebhookReplayFixture {
  try {
    return JSON.parse(source) as EncodedWebhookReplayFixture;
  } catch (error) {
    throw new InvalidWebhookFixtureProblem("fixture JSON could not be parsed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidWebhookFixtureProblem(`${field} must be a non-empty string`, { field });
  }
  return value;
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidWebhookFixtureProblem(`${field} must be a non-empty string when provided`, {
      field,
    });
  }

  return value;
}

function readHeaders(value: unknown): WebhookHeaders {
  if (!isRecord(value)) {
    throw new InvalidWebhookFixtureProblem("headers must be an object", { field: "headers" });
  }

  const headers: WebhookHeaders = {};
  for (const [name, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") {
      headers[name] = headerValue;
      continue;
    }

    if (Array.isArray(headerValue) && headerValue.every((entry) => typeof entry === "string")) {
      headers[name] = headerValue;
      continue;
    }

    throw new InvalidWebhookFixtureProblem("header values must be strings or string arrays", {
      field: "headers",
      header: name,
    });
  }

  return headers;
}

function readOptionalDate(value: unknown): Date | undefined {
  const rawValue = readOptionalString(value, "receivedAt");
  if (rawValue === undefined) {
    return undefined;
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidWebhookFixtureProblem("receivedAt must be an ISO date string", {
      receivedAt: rawValue,
    });
  }

  return date;
}

function readOptionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new InvalidWebhookFixtureProblem(`${field} must be an object when provided`, { field });
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
