import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCroco } from "../index.js";
import {
  formatOpsStatusReport,
  getOpsStatusExitCode,
  ops,
  runOpsCheck,
  runOpsStatus,
} from "../commands/ops.js";
import type { OpsStatusFetch } from "../commands/ops.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

describe("ops status", () => {
  beforeEach(() => {});
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the standard operational endpoints and summarizes a healthy app", async () => {
    const calls: FetchCall[] = [];
    const fetchStatus: OpsStatusFetch = async (input, init) => {
      calls.push({ input, init });

      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }
      if (input.endsWith("/diagnostics")) {
        return Response.json({ summary: "all_healthy", components: [], recentErrors: [] });
      }

      return Response.json({
        timestamp: "2026-06-16T00:00:00.000Z",
        metrics: {
          standardEndpointPathCount: 7,
          healthCheckCount: 0,
        },
      });
    };

    const report = await runOpsStatus("http://localhost:3000/api", {
      fetch: fetchStatus,
      token: "ops-secret",
      timeoutMs: 1000,
    });

    expect(report.summary).toBe("healthy");
    expect(report.endpoints.map((endpoint) => endpoint.url)).toEqual([
      "http://localhost:3000/api/health",
      "http://localhost:3000/api/ready",
      "http://localhost:3000/api/diagnostics",
      "http://localhost:3000/api/metrics",
    ]);
    expect(report.endpoints.map((endpoint) => [endpoint.name, endpoint.required])).toEqual([
      ["health", true],
      ["ready", true],
      ["diagnostics", false],
      ["metrics", false],
    ]);
    expect(calls).toHaveLength(4);
    expect(new Headers(calls[0].init?.headers).get("X-Diagnostics-Token")).toBeNull();
    expect(new Headers(calls[1].init?.headers).get("X-Diagnostics-Token")).toBeNull();
    expect(new Headers(calls[2].init?.headers).get("X-Diagnostics-Token")).toBe("ops-secret");
    expect(new Headers(calls[3].init?.headers).get("X-Diagnostics-Token")).toBeNull();
    expect(formatOpsStatusReport(report)).toContain("Croco ops status: healthy");
  });

  it("marks unavailable optional operational endpoints as degraded", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }

      return Response.json({ error: "Not Found" }, { status: 404 });
    };

    const report = await runOpsStatus("http://localhost:3000", { fetch: fetchStatus });

    expect(report.summary).toBe("degraded");
    expect(formatOpsStatusReport(report)).toContain("diagnostics 404 unavailable");
  });

  it("marks optional operational endpoints with failing payloads as degraded", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }

      return Response.json({ summary: "issues_detected", components: [], recentErrors: [] });
    };

    const report = await runOpsStatus("http://localhost:3000", { fetch: fetchStatus });

    expect(report.summary).toBe("degraded");
    expect(formatOpsStatusReport(report)).toContain("diagnostics 200 issues_detected");
  });

  it("checks required CI endpoints without metrics by default", async () => {
    const calls: FetchCall[] = [];
    const fetchStatus: OpsStatusFetch = async (input, init) => {
      calls.push({ input, init });

      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }

      return Response.json({ summary: "all_healthy", components: [], recentErrors: [] });
    };

    const report = await runOpsCheck("http://localhost:3000", {
      fetch: fetchStatus,
      token: "ops-secret",
    });

    expect(report.summary).toBe("healthy");
    expect(report.endpoints.map((endpoint) => endpoint.name)).toEqual([
      "health",
      "ready",
      "diagnostics",
    ]);
    expect(report.endpoints.map((endpoint) => endpoint.required)).toEqual([true, true, true]);
    expect(new Headers(calls[2].init?.headers).get("X-Diagnostics-Token")).toBe("ops-secret");
  });

  it("can include optional metrics in CI checks", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }
      if (input.endsWith("/diagnostics")) {
        return Response.json({ summary: "all_healthy", components: [], recentErrors: [] });
      }

      return Response.json({ error: "metrics unavailable" }, { status: 503 });
    };

    const report = await runOpsCheck("http://localhost:3000", {
      fetch: fetchStatus,
      includeMetrics: true,
    });

    expect(report.summary).toBe("degraded");
    expect(report.endpoints.map((endpoint) => [endpoint.name, endpoint.required])).toEqual([
      ["health", true],
      ["ready", true],
      ["diagnostics", true],
      ["metrics", false],
    ]);
  });

  it("marks missing diagnostics as unhealthy for CI checks", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }

      return Response.json({ error: "Forbidden" }, { status: 403 });
    };

    const report = await runOpsCheck("http://localhost:3000", { fetch: fetchStatus });

    expect(report.summary).toBe("unhealthy");
    expect(formatOpsStatusReport(report)).toContain("diagnostics 403 unavailable");
  });

  it("marks required operational endpoints with failing payloads as unhealthy", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/health")) {
        return Response.json({ status: "ok" });
      }
      if (input.endsWith("/ready")) {
        return Response.json({ status: "up", results: [] });
      }

      return Response.json({ summary: "issues_detected", components: [], recentErrors: [] });
    };

    const report = await runOpsCheck("http://localhost:3000", { fetch: fetchStatus });

    expect(report.summary).toBe("unhealthy");
  });

  it("marks a failing readiness endpoint as unhealthy", async () => {
    const fetchStatus: OpsStatusFetch = async (input) => {
      if (input.endsWith("/ready")) {
        return Response.json({ status: "down", results: [] }, { status: 503 });
      }

      return Response.json({ status: "ok" });
    };

    const report = await runOpsStatus("http://localhost:3000", { fetch: fetchStatus });

    expect(report.summary).toBe("unhealthy");
  });

  for (const name of ["health", "ready", "diagnostics"] as const) {
    it.each([
      ["HTML fallback", "<html>SPA fallback</html>"],
      ["empty body", ""],
      ["malformed JSON", '{"status":'],
      ["null", "null"],
      ["array", "[]"],
      ["empty object", "{}"],
      [
        "unknown state",
        '{"status":"surprise","summary":"surprise","results":[],"components":[],"recentErrors":[]}',
      ],
      [
        "wrong endpoint payload",
        name === "diagnostics"
          ? '{"status":"ok"}'
          : '{"summary":"all_healthy","components":[],"recentErrors":[]}',
      ],
    ])(`rejects ${name} with %s despite HTTP 200`, async (_label, body) => {
      const report = await runOpsCheck("http://localhost:3000", {
        fetch: async (input) =>
          input.endsWith(`/${name}`)
            ? new Response(body, { status: 200 })
            : healthyOperationalResponse(input),
      });

      expect(report.summary).toBe("unhealthy");
      expect(getOpsStatusExitCode(report.summary)).toBe(1);
      expect(report.endpoints.find((endpoint) => endpoint.name === name)).toMatchObject({
        httpStatus: 200,
        ok: false,
        error: expect.stringContaining(name),
      });
    });
  }

  it.each([
    ["ready", { status: "up" }],
    ["ready", { status: "up", results: {} }],
    ["diagnostics", { summary: "all_healthy" }],
    ["diagnostics", { summary: "all_healthy", components: {}, recentErrors: [] }],
    ["diagnostics", { summary: "all_healthy", components: [], recentErrors: null }],
  ])("rejects malformed %s payload structure %j", async (name, body) => {
    const report = await runOpsCheck("http://localhost:3000", {
      fetch: async (input) =>
        input.endsWith(`/${name}`) ? Response.json(body) : healthyOperationalResponse(input),
    });
    expect(report.summary).toBe("unhealthy");
  });

  it("accepts current health results and plain-text metrics", async () => {
    const report = await runOpsCheck("http://localhost:3000", {
      includeMetrics: true,
      fetch: async (input) =>
        input.endsWith("/metrics")
          ? new Response("# TYPE requests_total counter\nrequests_total 42\n")
          : healthyOperationalResponse(input),
    });
    expect(report.summary).toBe("healthy");
    expect(report.endpoints.every((endpoint) => endpoint.ok)).toBe(true);
  });

  it("marks invalid optional diagnostics as degraded", async () => {
    const report = await runOpsStatus("http://localhost:3000", {
      includeMetrics: false,
      fetch: async (input) =>
        input.endsWith("/diagnostics") ? Response.json({}) : healthyOperationalResponse(input),
    });
    expect(report.summary).toBe("degraded");
    expect(getOpsStatusExitCode(report.summary)).toBe(1);
  });

  it.each([
    ["HTML fallback", "<html>SPA fallback</html>", 1],
    ["empty JSON", "{}", 1],
    ["healthy contracts", null, 0],
  ])("returns the command exit code for %s", async (_label, body, exitCode) => {
    vi.stubGlobal("fetch", async (input: string) =>
      body === null ? healthyOperationalResponse(input) : new Response(body),
    );
    const stdout: string[] = [];
    const result = await runCroco(["ops", "check", "http://localhost:3000", "--json"], {
      stdout: (message) => stdout.push(message),
    });
    expect(result).toEqual({ exitCode });
    expect(JSON.parse(stdout.join(""))).toMatchObject({
      summary: exitCode === 0 ? "healthy" : "unhealthy",
    });
  });

  it("registers the status subcommand under ops", () => {
    expect(Object.keys(ops.subCommands ?? {})).toEqual(["check", "status"]);
  });

  it("uses non-zero exit codes for degraded and unhealthy summaries", () => {
    expect(getOpsStatusExitCode("healthy")).toBe(0);
    expect(getOpsStatusExitCode("degraded")).toBe(1);
    expect(getOpsStatusExitCode("unhealthy")).toBe(1);
  });

  it("reports invalid inputs as Problem details", async () => {
    await expect(runOpsStatus("not-a-url")).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.opsInvalidTargetUrl,
      extensions: {
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.opsInvalidTargetUrl,
      },
      status: 400,
    });
    await expect(runOpsStatus("http://localhost:3000", { timeoutMs: 0 })).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.opsInvalidTimeout,
      extensions: {
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.opsInvalidTimeout,
      },
      status: 400,
    });
  });
});

type FetchCall = {
  readonly input: string;
  readonly init?: RequestInit;
};

function healthyOperationalResponse(input: string): Response {
  if (input.endsWith("/diagnostics")) {
    return Response.json({ summary: "all_healthy", components: [], recentErrors: [] });
  }
  return Response.json({ status: "up", results: [{ name: "database", status: "up" }] });
}
