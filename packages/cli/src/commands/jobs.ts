import { defineCommand } from "citty";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { GLOBAL_OPTIONS } from "./options.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_TOKEN_HEADER = "X-Diagnostics-Token";

export type JobFailurePolicy = {
  readonly state: string;
  readonly needsAttention: boolean;
  readonly retryable: boolean;
  readonly replayable: boolean;
  readonly recoveryAction: string;
  readonly reason: string;
};

export type JobSummary = {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly workflowName?: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly replayOf?: string;
  readonly errorMessage?: string;
  readonly logCount: number;
  readonly failurePolicy: JobFailurePolicy;
};

export type JobLogEntry = {
  readonly timestamp: string;
  readonly level: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
};

export type JobDetails = JobSummary & {
  readonly payload?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly checkpoints?: Record<string, unknown>;
  readonly progress?: unknown;
  readonly logs: readonly JobLogEntry[];
};

export type JobListReport = {
  readonly summary: "healthy" | "attention";
  readonly generatedAt: string;
  readonly total: number;
  readonly attentionCount: number;
  readonly jobs: readonly JobSummary[];
};

export type JobsCommandClient = {
  list(options?: JobsListFilters): Promise<JobListReport>;
  show(id: string): Promise<JobDetails>;
  logs(id: string): Promise<readonly JobLogEntry[]>;
  cancel(id: string, params?: { readonly reason?: string }): Promise<JobDetails>;
  replay(id: string, params?: { readonly reason?: string }): Promise<JobDetails>;
};

export type JobsStatusFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type JobsListFilters = {
  readonly status?: string;
  readonly type?: string;
  readonly parentId?: string;
  readonly replayOf?: string;
  readonly limit?: number;
  readonly offset?: number;
};

export type RunJobsOptions = {
  readonly client?: JobsCommandClient;
  readonly fetch?: JobsStatusFetch;
  readonly timeoutMs?: number;
  readonly token?: string;
  readonly tokenHeader?: string;
};

class InvalidJobsTargetUrlProblem extends Problem {
  constructor(target: string) {
    super(
      "cli/invalid-jobs-target-url",
      ProblemCategory.BadRequest,
      `Invalid Croco app URL: ${target}`,
    );
  }
}

class InvalidJobsNumberProblem extends Problem {
  constructor(name: string, value: unknown) {
    super(
      "cli/invalid-jobs-number",
      ProblemCategory.BadRequest,
      `Invalid ${name}: ${String(value)}`,
    );
  }
}

class MissingJobsTargetUrlProblem extends Problem {
  constructor() {
    super(
      "cli/missing-jobs-target-url",
      ProblemCategory.BadRequest,
      "Missing Croco app URL. Pass --url or set CROCO_JOBS_URL.",
    );
  }
}

class JobsHttpProblem extends Problem {
  constructor(status: number, detail: string) {
    super(
      "cli/jobs-http-error",
      status === 404 ? ProblemCategory.NotFound : ProblemCategory.Conflict,
      `Jobs endpoint returned ${status}: ${detail}`,
    );
  }
}

const list = defineCommand({
  meta: {
    name: "list",
    description: "List Croco background jobs",
  },
  args: {
    ...GLOBAL_OPTIONS,
    url: {
      type: "string",
      description: "Croco app base URL. Defaults to CROCO_JOBS_URL.",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable jobs report",
    },
    token: {
      type: "string",
      description: "Jobs diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Jobs token header",
    },
    status: {
      type: "string",
      description: "Filter by execution status",
    },
    type: {
      type: "string",
      description: "Filter by execution type",
    },
    limit: {
      type: "string",
      description: "Maximum jobs to return",
    },
    offset: {
      type: "string",
      description: "Result offset",
    },
  },
  async run({ args }) {
    const report = await runJobsList(
      readJobsTarget(args.url),
      {
        token: typeof args.token === "string" ? args.token : undefined,
        tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
      },
      {
        status: readOptionalString(args.status),
        type: readOptionalString(args.type),
        limit: parseOptionalInteger("limit", args.limit),
        offset: parseOptionalInteger("offset", args.offset),
      },
    );

    console.log(args.json ? JSON.stringify(report, null, 2) : formatJobsListReport(report));
    process.exitCode = getJobsListExitCode(report);
  },
});

const show = defineCommand({
  meta: {
    name: "show",
    description: "Show one Croco background job",
  },
  args: {
    ...GLOBAL_OPTIONS,
    id: {
      type: "positional",
      required: true,
      description: "Job execution ID",
    },
    url: {
      type: "string",
      description: "Croco app base URL. Defaults to CROCO_JOBS_URL.",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable job details",
    },
    token: {
      type: "string",
      description: "Jobs diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Jobs token header",
    },
  },
  async run({ args }) {
    const job = await runJobsShow(String(args.id ?? ""), readJobsTarget(args.url), {
      token: typeof args.token === "string" ? args.token : undefined,
      tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
    });

    console.log(args.json ? JSON.stringify(job, null, 2) : formatJobDetails(job));
    process.exitCode = getJobExitCode(job);
  },
});

const logs = defineCommand({
  meta: {
    name: "logs",
    description: "Show logs for one Croco background job",
  },
  args: {
    ...GLOBAL_OPTIONS,
    id: {
      type: "positional",
      required: true,
      description: "Job execution ID",
    },
    url: {
      type: "string",
      description: "Croco app base URL. Defaults to CROCO_JOBS_URL.",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable log entries",
    },
    token: {
      type: "string",
      description: "Jobs diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Jobs token header",
    },
  },
  async run({ args }) {
    const entries = await runJobsLogs(String(args.id ?? ""), readJobsTarget(args.url), {
      token: typeof args.token === "string" ? args.token : undefined,
      tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
    });

    console.log(args.json ? JSON.stringify(entries, null, 2) : formatJobLogs(entries));
  },
});

const cancel = defineCommand({
  meta: {
    name: "cancel",
    description: "Cancel one Croco background job",
  },
  args: {
    ...GLOBAL_OPTIONS,
    id: {
      type: "positional",
      required: true,
      description: "Job execution ID",
    },
    url: {
      type: "string",
      description: "Croco app base URL. Defaults to CROCO_JOBS_URL.",
    },
    reason: {
      type: "string",
      description: "Operator cancellation reason",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable job details",
    },
    token: {
      type: "string",
      description: "Jobs diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Jobs token header",
    },
  },
  async run({ args }) {
    const job = await runJobsCancel(
      String(args.id ?? ""),
      readJobsTarget(args.url),
      {
        token: typeof args.token === "string" ? args.token : undefined,
        tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
      },
      {
        reason: readOptionalString(args.reason),
      },
    );

    console.log(args.json ? JSON.stringify(job, null, 2) : formatJobDetails(job));
    process.exitCode = getJobExitCode(job);
  },
});

const replay = defineCommand({
  meta: {
    name: "replay",
    description: "Replay one failed or timed-out Croco background job",
  },
  args: {
    ...GLOBAL_OPTIONS,
    id: {
      type: "positional",
      required: true,
      description: "Job execution ID",
    },
    url: {
      type: "string",
      description: "Croco app base URL. Defaults to CROCO_JOBS_URL.",
    },
    reason: {
      type: "string",
      description: "Operator replay reason",
    },
    json: {
      type: "boolean",
      description: "Print the machine-readable job details",
    },
    token: {
      type: "string",
      description: "Jobs diagnostics token",
    },
    tokenHeader: {
      type: "string",
      default: DEFAULT_TOKEN_HEADER,
      description: "Jobs token header",
    },
  },
  async run({ args }) {
    const job = await runJobsReplay(
      String(args.id ?? ""),
      readJobsTarget(args.url),
      {
        token: typeof args.token === "string" ? args.token : undefined,
        tokenHeader: typeof args.tokenHeader === "string" ? args.tokenHeader : DEFAULT_TOKEN_HEADER,
      },
      {
        reason: readOptionalString(args.reason),
      },
    );

    console.log(args.json ? JSON.stringify(job, null, 2) : formatJobDetails(job));
    process.exitCode = getJobExitCode(job);
  },
});

export const jobs = defineCommand({
  meta: {
    name: "jobs",
    description: "Inspect and recover Croco background jobs",
  },
  args: {
    ...GLOBAL_OPTIONS,
  },
  subCommands: {
    list,
    show,
    logs,
    cancel,
    replay,
  },
});

export async function runJobsList(
  target: string,
  options: RunJobsOptions = {},
  filters: JobsListFilters = {},
): Promise<JobListReport> {
  return createJobsClient(target, options).list(filters);
}

export async function runJobsShow(
  id: string,
  target: string,
  options: RunJobsOptions = {},
): Promise<JobDetails> {
  return createJobsClient(target, options).show(id);
}

export async function runJobsLogs(
  id: string,
  target: string,
  options: RunJobsOptions = {},
): Promise<readonly JobLogEntry[]> {
  return createJobsClient(target, options).logs(id);
}

export async function runJobsCancel(
  id: string,
  target: string,
  options: RunJobsOptions = {},
  params: { readonly reason?: string } = {},
): Promise<JobDetails> {
  return createJobsClient(target, options).cancel(id, params);
}

export async function runJobsReplay(
  id: string,
  target: string,
  options: RunJobsOptions = {},
  params: { readonly reason?: string } = {},
): Promise<JobDetails> {
  return createJobsClient(target, options).replay(id, params);
}

export function formatJobsListReport(report: JobListReport): string {
  const lines = [
    `Croco jobs: ${report.summary}`,
    `Total: ${report.total}`,
    `Attention: ${report.attentionCount}`,
    `Generated: ${report.generatedAt}`,
    "",
  ];

  for (const job of report.jobs) {
    lines.push(formatJobSummary(job));
  }

  return lines.join("\n");
}

export function formatJobDetails(job: JobDetails): string {
  const lines = [
    formatJobSummary(job),
    `created=${job.createdAt}`,
    `attempts=${job.attempts}/${job.maxAttempts}`,
    `policy=${job.failurePolicy.state} action=${job.failurePolicy.recoveryAction}`,
    `reason=${job.failurePolicy.reason}`,
  ];

  if (job.startedAt) {
    lines.push(`started=${job.startedAt}`);
  }
  if (job.completedAt) {
    lines.push(`completed=${job.completedAt}`);
  }
  if (job.errorMessage) {
    lines.push(`error=${job.errorMessage}`);
  }
  if (job.replayOf) {
    lines.push(`replayOf=${job.replayOf}`);
  }
  if (job.logCount > 0) {
    lines.push(`logs=${job.logCount}`);
  }

  return lines.join("\n");
}

export function formatJobLogs(entries: readonly JobLogEntry[]): string {
  if (entries.length === 0) {
    return "No job logs recorded.";
  }

  return entries
    .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`)
    .join("\n");
}

export function getJobsListExitCode(report: JobListReport): number {
  return report.summary === "healthy" ? 0 : 1;
}

export function getJobExitCode(job: JobSummary): number {
  return job.failurePolicy.needsAttention ? 1 : 0;
}

function createJobsClient(target: string, options: RunJobsOptions): JobsCommandClient {
  if (options.client) {
    return options.client;
  }

  return createHttpJobsClient(target, options);
}

function createHttpJobsClient(target: string, options: RunJobsOptions): JobsCommandClient {
  const fetchJobEndpoint = options.fetch ?? fetch;
  const timeoutMs =
    parseOptionalInteger("timeout", options.timeoutMs ?? DEFAULT_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
  const tokenHeader = options.tokenHeader ?? DEFAULT_TOKEN_HEADER;

  return {
    list(filters?: JobsListFilters): Promise<JobListReport> {
      return requestJobsEndpoint(target, "", {
        fetchJobEndpoint,
        token: options.token,
        tokenHeader,
        timeoutMs,
        query: filters,
      });
    },
    show(id: string): Promise<JobDetails> {
      return requestJobsEndpoint(target, `/${encodeURIComponent(id)}`, {
        fetchJobEndpoint,
        token: options.token,
        tokenHeader,
        timeoutMs,
      });
    },
    logs(id: string): Promise<readonly JobLogEntry[]> {
      return requestJobsEndpoint(target, `/${encodeURIComponent(id)}/logs`, {
        fetchJobEndpoint,
        token: options.token,
        tokenHeader,
        timeoutMs,
      });
    },
    cancel(id: string, params = {}): Promise<JobDetails> {
      return requestJobsEndpoint(target, `/${encodeURIComponent(id)}/cancel`, {
        fetchJobEndpoint,
        token: options.token,
        tokenHeader,
        timeoutMs,
        method: "POST",
        body: params,
      });
    },
    replay(id: string, params = {}): Promise<JobDetails> {
      return requestJobsEndpoint(target, `/${encodeURIComponent(id)}/replay`, {
        fetchJobEndpoint,
        token: options.token,
        tokenHeader,
        timeoutMs,
        method: "POST",
        body: params,
      });
    },
  };
}

async function requestJobsEndpoint<T>(
  target: string,
  path: string,
  options: {
    readonly fetchJobEndpoint: JobsStatusFetch;
    readonly timeoutMs: number;
    readonly token?: string;
    readonly tokenHeader: string;
    readonly method?: "GET" | "POST";
    readonly body?: unknown;
    readonly query?: Record<string, unknown>;
  },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });

  if (options.token) {
    headers.set(options.tokenHeader, options.token);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await options.fetchJobEndpoint(resolveJobsUrl(target, path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw new JobsHttpProblem(response.status, describeErrorBody(body));
    }

    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveJobsUrl(target: string, path: string, query?: Record<string, unknown>): string {
  const url = parseTargetUrl(target);
  const basePath = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}/jobs${path}`;
  url.search = "";
  url.hash = "";

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function parseTargetUrl(target: string): URL {
  try {
    return new URL(target);
  } catch {
    throw new InvalidJobsTargetUrlProblem(target);
  }
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

function describeErrorBody(body: unknown): string {
  if (isRecord(body)) {
    const detail = body.detail;
    if (typeof detail === "string") {
      return detail;
    }
    const message = body.message;
    if (typeof message === "string") {
      return message;
    }
  }

  return typeof body === "string" ? body : JSON.stringify(body);
}

function readJobsTarget(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof process.env.CROCO_JOBS_URL === "string" && process.env.CROCO_JOBS_URL.length > 0) {
    return process.env.CROCO_JOBS_URL;
  }

  throw new MissingJobsTargetUrlProblem();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseOptionalInteger(name: string, value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidJobsNumberProblem(name, value);
  }

  return parsed;
}

function formatJobSummary(job: JobSummary): string {
  const name = job.workflowName ? ` workflow=${job.workflowName}` : "";
  const error = job.errorMessage ? ` error=${job.errorMessage}` : "";
  return `${job.id} ${job.type} ${job.status} policy=${job.failurePolicy.state} action=${job.failurePolicy.recoveryAction}${name}${error}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
