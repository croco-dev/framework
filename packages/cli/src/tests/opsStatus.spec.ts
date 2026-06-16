import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { formatOpsStatusReport, getOpsStatusExitCode, ops, runOpsStatus } from "../commands/ops.js";
import type { OpsStatusFetch } from "../commands/ops.js";

describe("ops status", () => {
  beforeEach(() => {
    Container.reset();
  });

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

  it("registers the status subcommand under ops", () => {
    expect(Object.keys(ops.subCommands ?? {})).toEqual(["status"]);
  });

  it("uses non-zero exit codes for degraded and unhealthy summaries", () => {
    expect(getOpsStatusExitCode("healthy")).toBe(0);
    expect(getOpsStatusExitCode("degraded")).toBe(1);
    expect(getOpsStatusExitCode("unhealthy")).toBe(1);
  });

  it("reports invalid inputs as Problem details", async () => {
    await expect(runOpsStatus("not-a-url")).rejects.toMatchObject({
      code: "cli/invalid-ops-target-url",
      status: 400,
    });
    await expect(runOpsStatus("http://localhost:3000", { timeoutMs: 0 })).rejects.toMatchObject({
      code: "cli/invalid-ops-timeout",
      status: 400,
    });
  });
});

type FetchCall = {
  readonly input: string;
  readonly init?: RequestInit;
};
