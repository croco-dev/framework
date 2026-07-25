import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  InvalidOutboundWebhookSecretVersionProblem,
  InvalidOutboundWebhookUrlProblem,
} from "./OutboundWebhookProblems";
import type {
  OutboundWebhookEndpoint,
  OutboundWebhookSecret,
  OutboundWebhookUrlPolicy,
  OutboundWebhookValidatedTarget,
} from "./types";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

export function createOutboundWebhookUrlPolicy(options: {
  readonly resolveHostname: (hostname: string) => Promise<readonly string[]>;
}): OutboundWebhookUrlPolicy {
  return {
    async validate(rawUrl): Promise<OutboundWebhookValidatedTarget> {
      const url = validateOutboundWebhookUrlSyntax(rawUrl);
      const hostname = normalizeHostname(url.hostname);
      let addresses: readonly string[];
      try {
        addresses = isIP(hostname) === 0 ? await options.resolveHostname(hostname) : [hostname];
      } catch {
        throw new InvalidOutboundWebhookUrlProblem("hostname could not be resolved");
      }
      const uniqueAddresses = [...new Set(addresses.map(normalizeHostname))];
      if (uniqueAddresses.length === 0) {
        throw new InvalidOutboundWebhookUrlProblem("hostname did not resolve to an address");
      }
      if (uniqueAddresses.some((address) => isIP(address) === 0)) {
        throw new InvalidOutboundWebhookUrlProblem(
          "resolver returned a value that is not an IP address",
        );
      }
      if (uniqueAddresses.some(isBlockedIpAddress)) {
        throw new InvalidOutboundWebhookUrlProblem(
          "resolved address is private, reserved, link-local, metadata, or multicast",
        );
      }
      return {
        url: url.toString(),
        resolvedAddresses: uniqueAddresses,
      };
    },
  };
}

export const defaultOutboundWebhookUrlPolicy = createOutboundWebhookUrlPolicy({
  async resolveHostname(hostname): Promise<readonly string[]> {
    return (await lookup(hostname, { all: true, verbatim: true })).map(
      (address) => address.address,
    );
  },
});

export function validateOutboundWebhookUrlSyntax(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidOutboundWebhookUrlProblem("URL must be absolute");
  }
  if (url.protocol !== "https:") {
    throw new InvalidOutboundWebhookUrlProblem("HTTPS is required");
  }
  if (url.username !== "" || url.password !== "") {
    throw new InvalidOutboundWebhookUrlProblem("embedded credentials are forbidden");
  }
  const hostname = normalizeHostname(url.hostname);
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    (isIP(hostname) !== 0 && isBlockedIpAddress(hostname))
  ) {
    throw new InvalidOutboundWebhookUrlProblem(
      "local, private, link-local, metadata, and reserved targets are forbidden",
    );
  }
  return url;
}

export function signOutboundWebhook(
  body: Uint8Array,
  timestamp: string,
  secret: OutboundWebhookSecret,
): string {
  const mac = createHmac("sha256", secret.material);
  mac.update(timestamp);
  mac.update(".");
  mac.update(body);
  return `v1=${mac.digest("hex")}`;
}

export function verifyOutboundWebhookSignature(input: {
  readonly body: Uint8Array;
  readonly timestamp: string;
  readonly signature: string;
  readonly secretVersion: string;
  readonly endpoint: OutboundWebhookEndpoint;
  readonly secrets: readonly OutboundWebhookSecret[];
  readonly now: Date;
}): boolean {
  const allowedVersions = new Set([input.endpoint.activeSecretVersion]);
  if (
    input.endpoint.previousSecretVersion !== undefined &&
    input.endpoint.previousSecretValidUntil !== undefined &&
    input.endpoint.previousSecretValidUntil.getTime() >= input.now.getTime()
  ) {
    allowedVersions.add(input.endpoint.previousSecretVersion);
  }

  if (!allowedVersions.has(input.secretVersion)) {
    const expired =
      input.secretVersion === input.endpoint.previousSecretVersion &&
      input.endpoint.previousSecretValidUntil !== undefined;
    throw new InvalidOutboundWebhookSecretVersionProblem(
      input.endpoint.id,
      input.secretVersion,
      expired ? "expired" : "unknown",
    );
  }

  const secret = input.secrets.find(
    (candidate) =>
      candidate.tenantId === input.endpoint.tenantId &&
      candidate.endpointId === input.endpoint.id &&
      candidate.version === input.secretVersion,
  );
  if (!secret) {
    throw new InvalidOutboundWebhookSecretVersionProblem(
      input.endpoint.id,
      input.secretVersion,
      "unknown",
    );
  }
  if (secret.expiresAt !== undefined && secret.expiresAt.getTime() < input.now.getTime()) {
    throw new InvalidOutboundWebhookSecretVersionProblem(
      input.endpoint.id,
      input.secretVersion,
      "expired",
    );
  }

  const expected = Buffer.from(signOutboundWebhook(input.body, input.timestamp, secret));
  const actual = Buffer.from(input.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isBlockedIpAddress(hostname: string): boolean {
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) {
      return true;
    }
    return (
      octets[0] === 0 ||
      octets[0] === 10 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && (octets[1] === 0 || octets[1] === 168 || octets[1] === 88)) ||
      (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) ||
      (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) ||
      (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) ||
      octets[0] >= 224
    );
  }

  const normalized = normalizeHostname(hostname);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}
