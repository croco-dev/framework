import { afterEach, describe, expect, it } from "vitest";
import { enrichmentScopeKey } from "@croco/analytics-core/enrichment";
import { ExecutionManagerImpl } from "@croco/execution-core";
import { MemoryExecutionStore } from "../../../lifecycle-journey/src/MemoryExecutionStore";
import { createFixture, inputs, limits, scope } from "../fixture";
import { classifyBatch } from "../batch";
import { createDemoServer } from "../http";
import { MemoryStore } from "./MemoryStore";
const servers: ReturnType<typeof createDemoServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
async function fixture(budget = limits) {
  const f = createFixture(new MemoryStore());
  await f.operations.enqueue("demo", inputs, budget, { rawMs: 60000, resultMs: 120000 });
  const server = createDemoServer(f.operations, async () => "");
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (action: string, payload: unknown) =>
    fetch(`${base}/api`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
  return { ...f, base, post };
}
describe("authorized enrichment HTTP and batch integration", () => {
  it("blocks direct unreviewed exports, enforces server permission and rejects cross-site writes", async () => {
    const f = await fixture();
    const response = await f.post("export", {
      version: "v1",
      reason: "Checked",
      expectedRevision: 0,
      idempotencyKey: "e1",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "analytics-core/enrichment-review-required" });
    f.permissions.read = false;
    expect((await fetch(`${f.base}/api`)).status).toBe(403);
    f.permissions.read = true;
    const crossSite = await fetch(`${f.base}/api`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: JSON.stringify({ action: "classify", payload: { itemId: "course", version: "v1" } }),
    });
    expect(crossSite.status).toBe(403);
    expect((await f.service.read(scope, "demo")).requests).toBe(0);
  });
  it("keeps manual review authoritative, injects server actor and rejects stale revisions at the HTTP boundary", async () => {
    const f = await fixture();
    await f.operations.classify("demo", "order", "v1");
    const page = await f.operations.read("demo");
    const payload = {
      itemId: "order",
      version: "v1",
      labelId: "support",
      evidence: "Order lookup request",
      reason: "Checked synthetic source",
      expectedRevision: page.revision,
      idempotencyKey: "review1",
      actor: "attacker",
      tenant: "other",
    };
    const response = await f.post("review", payload);
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].review).toMatchObject({
      actor: "local-reviewer",
      labelId: "support",
    });
    const conflict = await f.post("review", {
      ...payload,
      labelId: "purchase",
      idempotencyKey: "review2",
    });
    expect(await conflict.json()).toEqual({ code: "analytics-core/enrichment-conflict" });
    const badLabel = await f.post("review", {
      ...payload,
      labelId: "execute-tool",
      idempotencyKey: "review3",
    });
    expect(await badLabel.json()).toEqual({ code: "analytics-core/enrichment-invalid-review" });
  });
  it("uses the existing chunk runner and checkpoint while retaining unknown as partial rather than successful classification", async () => {
    const f = await fixture();
    const executions = new ExecutionManagerImpl(new MemoryExecutionStore());
    const execution = await executions.create({
      type: "enrichment",
      payload: { runId: "demo", scopeKey: enrichmentScopeKey(scope) },
      maxAttempts: 1,
    });
    await expect(
      classifyBatch(
        executions,
        execution.id,
        f.service,
        scope,
        "demo",
        inputs.map((input) => input.itemId),
        "v1",
      ),
    ).rejects.toMatchObject({ code: "analytics-core/enrichment-provider-failed" });
    const completed = await executions.get(execution.id);
    expect(completed.checkpoints?.["enrichment.cursor"]).toBe(5);
    expect(completed.status).toBe("failed");
    expect((await f.operations.read("demo")).status).toBe("partial");
    const nextExecution = await executions.create({
      type: "enrichment",
      payload: { runId: "demo", scopeKey: enrichmentScopeKey(scope) },
      maxAttempts: 1,
    });
    await classifyBatch(
      executions,
      nextExecution.id,
      f.service,
      scope,
      "demo",
      inputs.map((input) => input.itemId),
      "v1",
    );
    expect((await f.operations.read("demo")).requests).toBe(4);
  });
  it("blocks an exhausted request budget at HTTP and still permits an authorized raw-source manual review", async () => {
    const f = await fixture({ ...limits, maxRequests: 1 });
    expect((await f.post("classify", { itemId: "course", version: "v1" })).status).toBe(200);
    const blocked = await f.post("classify", { itemId: "uncertain", version: "v1" });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ code: "analytics-core/enrichment-budget-exhausted" });
    const page = await f.operations.read("demo");
    const manual = await f.post("review", {
      itemId: "uncertain",
      version: "v1",
      labelId: "support",
      evidence: "Human reviewed the live original",
      reason: "Manual review after budget rejection",
      expectedRevision: page.revision,
      idempotencyKey: "budget-review",
    });
    expect(manual.status).toBe(200);
    expect((await manual.json()).items[2].review).toMatchObject({
      candidateRef: null,
      definitionVersion: "v1",
      actor: "local-reviewer",
    });
    expect((await f.operations.read("demo")).requests).toBe(1);
  });
});
