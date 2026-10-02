import { describe, expect, it, vi } from "vitest";
import { ExperimentRuntime, InMemoryExperimentStore } from "@croco/features-core";
import { ExperimentOperations } from "../libs/ExperimentOperations";
import type {
  ExperimentAdminAccess,
  ExperimentAdminConfigureCommand,
} from "../libs/ExperimentOperations";
import type { ExperimentDefinition, ExperimentScope } from "@croco/features-core";

const scope = { app: "shop", environment: "test", tenantId: "tenant-a" };
const target = { experimentId: "checkout", experimentRevision: "1", scope };
const definition: ExperimentDefinition = {
  id: target.experimentId,
  revision: "1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "private-salt",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [{ id: "control", value: false, weight: 10000 }],
  hypothesis: "Clear checkout helps",
  observationPlan: "Completion per assigned subject",
  eligibility: "all",
};
const access: ExperimentAdminAccess = {
  scope,
  actor: "operator",
  permissions: [
    "experiment.read",
    "experiment.preview",
    "experiment.operate",
    "experiment.configure",
  ],
};
async function fixture() {
  const store = new InMemoryExperimentStore();
  const runtime = new ExperimentRuntime({
    store,
    authorization: {
      authorize: (request) =>
        request.actor === "operator" &&
        request.scope.tenantId === scope.tenantId &&
        (!request.subject || request.subject.id === "owned"),
    },
  });
  await runtime.register(
    { definition, handlers: { control: () => false }, eligibility: () => ({ status: "eligible" }) },
    scope,
    access.actor,
  );
  const operations = new ExperimentOperations(
    runtime,
    () => [
      {
        id: "sample",
        label: "Owned sample",
        subject: { kind: "user", id: "owned" },
        context: { privateTrait: "hidden" },
      },
    ],
    ["all"],
  );
  return { store, runtime, operations };
}
const command = {
  ...target,
  action: "start" as const,
  expectedRevision: 0,
  reason: "Run test",
  idempotencyKey: "start-1",
};
describe("ExperimentOperations", () => {
  it("projects registered public fields without salt, private sample traits or subject identities", async () => {
    const { operations } = await fixture();
    const snapshot = await operations.read(target, access);
    expect(snapshot.definition.variants[0]?.value).toBe(false);
    expect(snapshot.samples).toEqual([{ id: "sample", label: "Owned sample" }]);
    expect(JSON.stringify(snapshot)).not.toMatch(/private-salt|privateTrait|hidden|"owned"/);
  });
  it("denies omitted and forged tenant, app/environment and action permissions", async () => {
    const { operations } = await fixture();
    for (const invalidScope of [
      { ...scope, tenantId: undefined },
      { ...scope, tenantId: null },
      { ...scope, tenantId: "tenant-b" },
      { ...scope, app: "other" },
      { ...scope, environment: "production" },
    ])
      await expect(
        operations.read({ ...target, scope: invalidScope as ExperimentScope }, access),
      ).rejects.toMatchObject({ code: "features/experiment/admin-denied" });
    await expect(
      operations.command(command, { ...access, permissions: ["experiment.read"] }),
    ).rejects.toMatchObject({ code: "features/experiment/admin-denied" });
    await expect(
      operations.command(command, { ...access, permissions: ["experiment.operate"] }),
    ).rejects.toMatchObject({ code: "features/experiment/admin-denied" });
  });
  it("previews only server-owned samples without state, assignment or exposure writes", async () => {
    const { operations, store } = await fixture();
    const before = await store.get(target);
    const assign = vi.spyOn(store, "assign");
    const exposure = vi.spyOn(store, "recordExposure");
    const command = vi.spyOn(store, "command");
    await expect(operations.preview(target, "sample", access)).resolves.toEqual({
      status: "evaluated",
      value: false,
      reason: "local_preview",
      appRevision: target.experimentRevision,
    });
    expect(await store.get(target)).toEqual(before);
    expect(assign).not.toHaveBeenCalled();
    expect(exposure).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
    await expect(operations.preview(target, "forged-subject", access)).rejects.toMatchObject({
      code: "features/experiment/admin-denied",
    });
  });
  it("uses server actor and real command receipts with version and payload conflict checks", async () => {
    const { operations } = await fixture();
    const result = await operations.command(
      { ...command, actor: "forged" } as typeof command,
      access,
    );
    expect(result.state).toBe("running");
    expect(result.version).toBe(1);
    expect(await operations.command(command, access)).toEqual(result);
    await expect(
      operations.command({ ...command, reason: "Changed payload" }, access),
    ).rejects.toMatchObject({ code: "features/experiment/idempotency-conflict" });
    await expect(
      operations.command({ ...command, action: "pause", idempotencyKey: "pause" }, access),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
  });
  it("creates immutable configured revisions but denies unregistered variants and eligibility", async () => {
    const { operations, runtime } = await fixture();
    const configuration = {
      ...definition,
      revision: "2",
      unit: "tenant" as const,
      observationPlan: "Tenant completion",
      salt: "client-salt",
    };
    const input: ExperimentAdminConfigureCommand = {
      ...target,
      configuration,
      expectedRevision: 0,
      reason: "Tenant experiment",
      idempotencyKey: "configure",
    };
    const result = await operations.configure(input, access);
    expect(result.definition.unit).toBe("tenant");
    expect((await runtime.get(result.target, access.actor))?.definition.salt).toBe("private-salt");
    expect((await runtime.get(target, access.actor))?.definition.unit).toBe("user");
    await expect(
      operations.configure(
        { ...input, configuration: { ...configuration, revision: "3", eligibility: "unknown" } },
        access,
      ),
    ).rejects.toMatchObject({ code: "features/experiment/admin-denied" });
    await expect(
      operations.configure(
        {
          ...input,
          idempotencyKey: "forged",
          configuration: {
            ...configuration,
            revision: "3",
            variants: [{ id: "private-handler", value: true, weight: 10000 }],
          },
        },
        access,
      ),
    ).rejects.toMatchObject({ code: "features/experiment/invalid" });
  });
});
