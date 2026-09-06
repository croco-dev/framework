import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
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
const OUTBOUND_WEBHOOK_SIGNATURE_TOLERANCE_MS = 300_000;

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

  const timestampMs = parseUnixTimestampMilliseconds(input.timestamp);
  const nowMs = input.now.getTime();
  if (
    timestampMs === undefined ||
    !Number.isFinite(nowMs) ||
    Math.abs(nowMs - timestampMs) > OUTBOUND_WEBHOOK_SIGNATURE_TOLERANCE_MS
  ) {
    return false;
  }

  const expected = Buffer.from(signOutboundWebhook(input.body, input.timestamp, secret));
  const actual = Buffer.from(input.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function parseUnixTimestampMilliseconds(timestamp: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)$/.test(timestamp)) {
    return undefined;
  }

  const timestampMs = Number(timestamp) * 1_000;
  return Number.isSafeInteger(timestampMs) ? timestampMs : undefined;
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function createBlockedIpRanges(): BlockList {
  const ranges = new BlockList();

  ranges.addSubnet("0.0.0.0", 8, "ipv4");
  ranges.addSubnet("10.0.0.0", 8, "ipv4");
  ranges.addSubnet("100.64.0.0", 10, "ipv4");
  ranges.addSubnet("127.0.0.0", 8, "ipv4");
  ranges.addSubnet("169.254.0.0", 16, "ipv4");
  ranges.addSubnet("172.16.0.0", 12, "ipv4");
  ranges.addSubnet("192.0.0.0", 24, "ipv4");
  ranges.addSubnet("192.0.2.0", 24, "ipv4");
  ranges.addSubnet("192.88.99.0", 24, "ipv4");
  ranges.addSubnet("192.168.0.0", 16, "ipv4");
  ranges.addSubnet("198.18.0.0", 15, "ipv4");
  ranges.addSubnet("198.51.100.0", 24, "ipv4");
  ranges.addSubnet("203.0.113.0", 24, "ipv4");
  ranges.addSubnet("224.0.0.0", 4, "ipv4");
  ranges.addSubnet("240.0.0.0", 4, "ipv4");
  ranges.addAddress("255.255.255.255", "ipv4");

  ranges.addSubnet("::", 96, "ipv6");
  ranges.addSubnet("64:ff9b:1::", 48, "ipv6");
  ranges.addSubnet("100::", 64, "ipv6");
  ranges.addSubnet("2001:2::", 48, "ipv6");
  ranges.addSubnet("2001:db8::", 32, "ipv6");
  ranges.addSubnet("fc00::", 7, "ipv6");
  ranges.addSubnet("fe80::", 10, "ipv6");
  ranges.addSubnet("ff00::", 8, "ipv6");

  return ranges;
}

const BLOCKED_IP_RANGES = createBlockedIpRanges();

export function isBlockedIpAddress(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) {
      return true;
    }
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return BLOCKED_IP_RANGES.check(normalized, "ipv4");
  }
  if (ipVersion === 6) {
    return BLOCKED_IP_RANGES.check(normalized, "ipv6");
  }
  return false;
}
