import { cp, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MetricReadService } from "@croco/metrics-core/runtime";
import type {
  MetricReadAuthority,
  RegisteredMetricDefinition,
  RegisteredMetricQuery,
  VerifiedReportReader,
} from "@croco/metrics-core/runtime";
import { createAgentReadTools } from "../libs/agentReadTools.js";
import type { AgentReadApplication } from "../libs/agentReadTools.js";

type Example = {
  createExampleApplication(root: string): AgentReadApplication;
  createExampleComponents(root: string): {
    queries: RegisteredMetricQuery[];
    authority: MetricReadAuthority;
    reports: VerifiedReportReader;
  };
  definition: RegisteredMetricDefinition;
  window: { from: string; to: string };
};
const exampleUrl = new URL("../../examples/agent-read/application.mjs", import.meta.url).href;
const setupUrl = new URL("../../examples/agent-read/setup.mjs", import.meta.url).href;
const example = (await import(exampleUrl)) as Example;
const setup = (await import(setupUrl)) as { createExampleFiles(root: string): Promise<void> };

let root: string;
let templateRoot: string;
let application: AgentReadApplication;
beforeAll(async () => {
  templateRoot = await mkdtemp(join(tmpdir(), "croco-agent-template-"));
  await setup.createExampleFiles(templateRoot);
});
afterAll(async () => rm(templateRoot, { recursive: true, force: true }));
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "croco-agent-tools-"));
  await cp(templateRoot, root, { recursive: true });
  application = example.createExampleApplication(root);
});
afterEach(async () => rm(root, { recursive: true, force: true }));
const request = (queryId = "frontend.actions") => ({ queryId, input: {}, window: example.window });

function withService(change: (components: ReturnType<Example["createExampleComponents"]>) => void) {
  const components = example.createExampleComponents(root);
  change(components);
  return createAgentReadTools({
    ...application,
    service: new MetricReadService(
      [example.definition],
      components.queries,
      components.authority,
      components.reports,
    ),
  });
}

describe("agent read tools", () => {
  it("uses the generated manifest executor and the local reviewed report reader", async () => {
    const tools = createAgentReadTools(application);
    expect(await tools.call("runRegisteredQuery", request("frontend.actions.live"))).toMatchObject({
      status: "verified",
      source: "executor",
      result: { data: { actionCount: 1 } },
      sourceLocations: [{ path: "frontend-actions.json" }],
    });
    expect(await tools.call("getVerifiedReport", request())).toMatchObject({
      status: "verified",
      report: { result: { data: { actionCount: 1 } } },
    });
    expect(await tools.call("runRegisteredQuery", request())).toMatchObject({
      status: "verified",
      source: "report",
    });
  });

  it("evaluates the generated artifact against the requested half-open window", async () => {
    const outcome = await createAgentReadTools(application).call("runRegisteredQuery", {
      ...request("frontend.actions.live"),
      window: { from: "2026-09-02T00:00:00.000Z", to: "2026-09-03T00:00:00.000Z" },
    });
    expect(outcome).toMatchObject({ status: "verified", result: { data: { actionCount: 0 } } });
  });

  it("rejects tampered report payload and provenance through the reader", async () => {
    const reports = JSON.parse(await readFile(join(root, "reviewed-reports.json"), "utf8"));
    reports[0].result.data.actionCount = 99;
    await writeFile(join(root, "reviewed-reports.json"), JSON.stringify(reports));
    expect(
      await createAgentReadTools(application).call("getVerifiedReport", request()),
    ).toMatchObject({ status: "unavailable" });
    await setup.createExampleFiles(root);
    await writeFile(join(root, "review-provenance.json"), "{}");
    expect(
      await createAgentReadTools(application).call("getVerifiedReport", request()),
    ).toMatchObject({ status: "unavailable" });
  });

  it("returns registered source locations without file contents", async () => {
    const response = await createAgentReadTools(application).call("getSourceRef", {
      definitionId: example.definition.id,
      sourceRef: "frontend-manifest",
    });
    expect(response).toEqual({ source: application.sources[0] });
    expect(JSON.stringify(response)).not.toContain("UsersController");
  });

  it("resolves source metadata within one authorization time budget", async () => {
    const tools = withService(({ authority }) => {
      const authorize = authority.authorize;
      const currentContext = authority.currentContext;
      authority.currentContext = () => {
        const context = currentContext();
        return { ...context, budget: { ...context.budget, maxTimeMs: 100 } };
      };
      authority.authorize = async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return authorize(...args);
      };
    });
    vi.useFakeTimers();
    try {
      const started = Date.now();
      const read = tools
        .call("getSourceRef", {
          definitionId: example.definition.id,
          sourceRef: "frontend-manifest",
        })
        .then((result) => ({ result, elapsed: Date.now() - started }));
      await vi.advanceTimersByTimeAsync(200);
      const { result, elapsed } = await read;
      expect(result).toEqual({ source: application.sources[0] });
      expect(elapsed).toBeLessThanOrEqual(100);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    "../outside",
    "/etc/passwd",
    ".env",
    "nested/.env.local",
    "credentials.json",
    "secret.pem",
    "a\\b",
  ])("rejects invalid registered source %s", (path) => {
    expect(() =>
      createAgentReadTools({ ...application, sources: [{ ...application.sources[0]!, path }] }),
    ).toThrow();
  });

  it("rejects source symlinks at startup and after registration", async () => {
    await symlink(join(root, "frontend-actions.json"), join(root, "linked.json"));
    expect(() =>
      createAgentReadTools({
        ...application,
        sources: [{ ...application.sources[0]!, path: "linked.json" }],
      }),
    ).toThrow();
    const tools = createAgentReadTools(application);
    await rm(join(root, "frontend-actions.json"));
    await symlink(join(root, "reviewed-reports.json"), join(root, "frontend-actions.json"));
    expect(
      await tools.call("getSourceRef", {
        definitionId: example.definition.id,
        sourceRef: "frontend-manifest",
      }),
    ).toMatchObject({ status: "unavailable" });
  });

  it("reports a disappeared registered source as unavailable", async () => {
    const tools = createAgentReadTools(application);
    await rm(join(root, "frontend-actions.json"));
    expect(
      await tools.call("getSourceRef", {
        definitionId: example.definition.id,
        sourceRef: "frontend-manifest",
      }),
    ).toMatchObject({ status: "unavailable" });
  });

  it("rejects registered query input outside its schema", async () => {
    expect(
      await createAgentReadTools(application).call("runRegisteredQuery", {
        ...request(),
        input: { raw: true },
      }),
    ).toMatchObject({ status: "invalid-input" });
  });

  it("rejects unknown tools and client authority, file, or SQL arguments", async () => {
    const tools = createAgentReadTools(application);
    expect(await tools.call("executeSql", {})).toMatchObject({ status: "unavailable" });
    for (const extra of [
      { principal: { tenant: "other" } },
      { sql: "select 1" },
      { path: "../outside" },
    ]) {
      expect(await tools.call("runRegisteredQuery", { ...request(), ...extra })).toMatchObject({
        status: "invalid-input",
      });
    }
    expect(
      await tools.call("getSourceRef", {
        definitionId: example.definition.id,
        sourceRef: "../outside",
      }),
    ).toMatchObject({ status: "unavailable" });
    expect(
      await tools.call("runRegisteredQuery", {
        ...request(),
        window: { from: "invalid", to: "invalid" },
      }),
    ).toMatchObject({ status: "invalid-input" });
  });

  it("enforces response and query time budgets and cancellation", async () => {
    expect(
      await createAgentReadTools({ ...application, maxResponseBytes: 128 }).call(
        "listDefinitions",
        {},
      ),
    ).toMatchObject({ status: "budget-exceeded", truncated: true });
    const controller = new AbortController();
    controller.abort();
    expect(
      await createAgentReadTools(application).call("listDefinitions", {}, controller.signal),
    ).toMatchObject({ status: "cancelled" });
    const tools = withService((components) => {
      components.queries = components.queries.map((query) => ({
        ...query,
        limits: { ...query.limits, maxTimeMs: 10 },
        readExecutor: async () => new Promise(() => {}),
      }));
    });
    expect(await tools.call("runRegisteredQuery", request("frontend.actions.live"))).toMatchObject({
      status: "timeout",
    });
  });

  it("preserves permission denial and hides untrusted errors and raw audits", async () => {
    const denied = withService((components) => {
      components.authority.authorize = async () => null;
    });
    expect(await denied.call("runRegisteredQuery", request())).toMatchObject({ status: "denied" });
    const failed = withService((components) => {
      components.authority.authorize = async () => {
        throw new TypeError("private-token-and-audit");
      };
    });
    const response = await failed.call("listDefinitions", {});
    expect(response).toEqual({ status: "error", code: "agent-read/internal-error" });
    expect(JSON.stringify(response)).not.toContain("private-token");
    expect(
      await createAgentReadTools(application).call("listRegisteredQueries", {}),
    ).not.toHaveProperty("audit");
  });

  it("bounds artifact reads before parsing oversized local files", async () => {
    await writeFile(join(root, "frontend-actions.json"), " ".repeat(10001));
    expect(
      await createAgentReadTools(application).call(
        "runRegisteredQuery",
        request("frontend.actions.live"),
      ),
    ).toMatchObject({ status: "budget-exceeded" });
  });

  it("applies the effective query byte budget before parsing the artifact", async () => {
    const tools = withService((components) => {
      components.queries = components.queries.map((query) => ({
        ...query,
        limits: { ...query.limits, maxBytes: 100 },
      }));
    });
    expect(await tools.call("runRegisteredQuery", request("frontend.actions.live"))).toMatchObject({
      status: "budget-exceeded",
    });
  });

  it.each(["frontend-actions.json", "reviewed-reports.json", "review-provenance.json"])(
    "refuses a symlinked local artifact before reading %s",
    async (name) => {
      const components = example.createExampleComponents(root);
      await rename(join(root, name), join(root, "original.json"));
      await symlink(join(root, "original.json"), join(root, name));
      const reading =
        name === "frontend-actions.json"
          ? components.queries[0]!.readExecutor({
              input: {},
              window: example.window,
              context: await components.authority.currentContext(),
              signal: new AbortController().signal,
            })
          : name === "reviewed-reports.json"
            ? components.reports.readCandidates(
                "frontend.actions",
                "{}",
                (await components.authority.currentContext()).principal,
              )
            : components.reports.verify(
                JSON.parse(await readFile(join(root, "reviewed-reports.json"), "utf8"))[0],
              );
      await expect(reading).rejects.toMatchObject({ code: "metrics-core/source-revision-missing" });
    },
  );

  it("refuses a workspace directory replaced with a symlink before artifact I/O", async () => {
    const components = example.createExampleComponents(root);
    const moved = `${root}-moved`;
    await rename(root, moved);
    await symlink(moved, root);
    try {
      await expect(
        components.reports.readCandidates(
          "frontend.actions",
          "{}",
          (await components.authority.currentContext()).principal,
        ),
      ).rejects.toMatchObject({ code: "metrics-core/source-revision-missing" });
    } finally {
      await rm(root);
      await rename(moved, root);
    }
  });

  it("honors changed privacy epochs before reusing reviewed results", async () => {
    const tools = withService((components) => {
      components.authority.authorize = async () => ({
        permissionEpoch: "permission-1",
        privacyEpoch: "privacy-2",
      });
    });
    expect(await tools.call("getVerifiedReport", request())).toMatchObject({ status: "denied" });
  });
});
