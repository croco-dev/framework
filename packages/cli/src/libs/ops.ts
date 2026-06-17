import { Problem, ProblemCategory } from "@croco/problems-core";

const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_TOKEN_HEADER = "X-Diagnostics-Token";

const OPS_ENDPOINTS = [
  { name: "health", path: "/health" },
  { name: "ready", path: "/ready" },
  { name: "diagnostics", path: "/diagnostics" },
  { name: "metrics", path: "/metrics" },
] as const;

export type OpsEndpointName = (typeof OPS_ENDPOINTS)[number]["name"];

export type OpsEndpointSnapshot = {
  readonly name: OpsEndpointName;
  readonly url: string;
  readonly required: boolean;
  readonly httpStatus: number | null;
  readonly ok: boolean;
  readonly body: unknown;
  readonly error?: string;
};

export type OpsStatusSummary = "healthy" | "degraded" | "unhealthy";

export type OpsStatusReport = {
  readonly target: string;
  readonly timestamp: string;
  readonly summary: OpsStatusSummary;
  readonly endpoints: readonly OpsEndpointSnapshot[];
};

export type OpsStatusFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type RunOpsStatusOptions = {
  readonly fetch?: OpsStatusFetch;
  readonly includeMetrics?: boolean;
  readonly requiredEndpoints?: readonly OpsEndpointName[];
  readonly timeoutMs?: number;
  readonly token?: string;
  readonly tokenHeader?: string;
};

const STATUS_REQUIRED_ENDPOINTS = ["health", "ready"] satisfies readonly OpsEndpointName[];
const CHECK_REQUIRED_ENDPOINTS = [
  "health",
  "ready",
  "diagnostics",
] satisfies readonly OpsEndpointName[];

class InvalidOpsTimeoutProblem extends Problem {
  constructor(value: unknown) {
    super(
      "cli/invalid-ops-timeout",
      ProblemCategory.BadRequest,
      `Invalid timeout: ${String(value)}`,
    );
  }
}

class InvalidOpsTargetUrlProblem extends Problem {
  constructor(target: string) {
    super(
      "cli/invalid-ops-target-url",
      ProblemCategory.BadRequest,
      `Invalid Croco app URL: ${target}`,
    );
  }
}

export async function runOpsCheck(
  target: string,
  options: RunOpsStatusOptions = {},
): Promise<OpsStatusReport> {
  return runOpsStatus(target, {
    ...options,
    includeMetrics: options.includeMetrics ?? false,
    requiredEndpoints: options.requiredEndpoints ?? CHECK_REQUIRED_ENDPOINTS,
  });
}

export async function runOpsStatus(
  target: string,
  options: RunOpsStatusOptions = {},
): Promise<OpsStatusReport> {
  const targetUrl = parseTargetUrl(target);
  const fetchEndpoint = options.fetch ?? fetch;
  const timeoutMs =
    parseOpsTimeoutMs(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
  const tokenHeader = options.tokenHeader ?? DEFAULT_TOKEN_HEADER;
  const requiredEndpoints = new Set(options.requiredEndpoints ?? STATUS_REQUIRED_ENDPOINTS);
  const endpoints = selectOpsEndpoints(options.includeMetrics ?? true);
  const snapshots = await Promise.all(
    endpoints.map(async (endpoint) =>
      fetchOperationalEndpoint({
        endpoint,
        fetchEndpoint,
        required: requiredEndpoints.has(endpoint.name),
        targetUrl,
        timeoutMs,
        token: options.token,
        tokenHeader,
      }),
    ),
  );

  return {
    target: targetUrl.toString(),
    timestamp: new Date().toISOString(),
    summary: summarizeOpsStatus(snapshots),
    endpoints: snapshots,
  };
}

export function formatOpsStatusReport(report: OpsStatusReport): string {
  const lines = [
    `Croco ops status: ${report.summary}`,
    `Target: ${report.target}`,
    `Checked: ${report.timestamp}`,
    "",
  ];

  for (const endpoint of report.endpoints) {
    const httpStatus = endpoint.httpStatus === null ? "ERR" : String(endpoint.httpStatus);
    const status = describeEndpointStatus(endpoint);
    const suffix = endpoint.error ? ` - ${endpoint.error}` : "";
    lines.push(`${endpoint.name.padEnd(11)} ${httpStatus.padEnd(3)} ${status}${suffix}`);
  }

  return lines.join("\n");
}

export function getOpsStatusExitCode(summary: OpsStatusSummary): number {
  return summary === "healthy" ? 0 : 1;
}

export function parseOpsTimeoutMs(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidOpsTimeoutProblem(value);
  }

  return parsed;
}

function parseTargetUrl(target: string): URL {
  try {
    return new URL(target);
  } catch {
    throw new InvalidOpsTargetUrlProblem(target);
  }
}

async function fetchOperationalEndpoint({
  endpoint,
  fetchEndpoint,
  required,
  targetUrl,
  timeoutMs,
  token,
  tokenHeader,
}: {
  readonly endpoint: (typeof OPS_ENDPOINTS)[number];
  readonly fetchEndpoint: OpsStatusFetch;
  readonly required: boolean;
  readonly targetUrl: URL;
  readonly timeoutMs: number;
  readonly token?: string;
  readonly tokenHeader: string;
}): Promise<OpsEndpointSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers({ Accept: "application/json" });

  if (token && endpoint.name === "diagnostics") {
    headers.set(tokenHeader, token);
  }

  const url = resolveEndpointUrl(targetUrl, endpoint.path);

  try {
    const response = await fetchEndpoint(url, {
      headers,
      signal: controller.signal,
    });
    const body = await readResponseBody(response);

    return {
      name: endpoint.name,
      url,
      required,
      httpStatus: response.status,
      ok: response.ok,
      body,
    };
  } catch (error) {
    return {
      name: endpoint.name,
      url,
      required,
      httpStatus: null,
      ok: false,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveEndpointUrl(targetUrl: URL, path: string): string {
  const url = new URL(targetUrl.toString());
  const basePath = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function selectOpsEndpoints(includeMetrics: boolean): readonly (typeof OPS_ENDPOINTS)[number][] {
  if (includeMetrics) {
    return OPS_ENDPOINTS;
  }

  return OPS_ENDPOINTS.filter((endpoint) => endpoint.name !== "metrics");
}

function summarizeOpsStatus(endpoints: readonly OpsEndpointSnapshot[]): OpsStatusSummary {
  if (endpoints.some((endpoint) => isEndpointUnhealthy(endpoint))) {
    return "unhealthy";
  }

  if (endpoints.some((endpoint) => isEndpointDegraded(endpoint))) {
    return "degraded";
  }

  return "healthy";
}

function isEndpointUnhealthy(endpoint: OpsEndpointSnapshot): boolean {
  if (!endpoint.ok) {
    return endpoint.required;
  }

  const status = readStringField(endpoint.body, "status");
  const summary = readStringField(endpoint.body, "summary");

  return endpoint.required && hasFailureStatus(status, summary);
}

function isEndpointDegraded(endpoint: OpsEndpointSnapshot): boolean {
  if (!endpoint.ok) {
    return true;
  }

  const status = readStringField(endpoint.body, "status");
  const summary = readStringField(endpoint.body, "summary");

  return status === "degraded" || summary === "degraded" || hasFailureStatus(status, summary);
}

function hasFailureStatus(status: string | undefined, summary: string | undefined): boolean {
  return (
    status === "down" ||
    status === "error" ||
    status === "unhealthy" ||
    summary === "issues_detected"
  );
}

function describeEndpointStatus(endpoint: OpsEndpointSnapshot): string {
  if (!endpoint.ok) {
    return "unavailable";
  }

  const status = readStringField(endpoint.body, "status");
  const summary = readStringField(endpoint.body, "summary");

  if (status) {
    return status;
  }

  if (summary) {
    return summary;
  }

  if (endpoint.name === "metrics") {
    return "available";
  }

  return "ok";
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
