import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { OnboardingState } from "@croco/onboarding-core";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleOnboardingStore,
  type DrizzleOnboardingClient,
} from "../libs/DrizzleOnboardingStore";

const connectionString = process.env.ONBOARDING_POSTGRES_URL ?? "";
const schemaName = `onboarding_reset_${randomUUID().replaceAll("-", "")}`;
const tenantId = "tenant-reset";
const userId = "user-reset";
const onboardingId = "onboarding-reset";

describe.skipIf(!connectionString)("DrizzleOnboardingStore PostgreSQL", () => {
  let adminPool: Pool;
  let pool: Pool;
  let store: DrizzleOnboardingStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 1 });
    await adminPool.query(`create schema ${schemaName}`);
    pool = new Pool({ connectionString, max: 2, options: `-c search_path=${schemaName}` });
    await pool.query(`
      create table onboarding_states (
        tenant_id text not null,
        user_id text not null,
        onboarding_id text not null,
        steps jsonb not null default '{}'::jsonb,
        is_completed boolean not null default false,
        completed_at timestamp,
        status text,
        started_at timestamp,
        current_step_id text,
        completion_step_id text,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now(),
        primary key (tenant_id, user_id, onboarding_id)
      )
    `);
    const db = drizzle(pool) as unknown as DrizzleOnboardingClient;
    store = new DrizzleOnboardingStore(db, new TxManager(createDrizzleTxAdapter(db)));
  });

  beforeEach(async () => {
    await pool.query("truncate onboarding_states");
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      try {
        await adminPool.query(`drop schema if exists ${schemaName} cascade`);
      } finally {
        await adminPool.end();
      }
    }
  });

  const completeStep = (stepId: string, completedAt: string) =>
    store.completeStep(tenantId, userId, onboardingId, {
      stepId,
      requiredStepIds: ["profile", "invite"],
      completedAt: new Date(completedAt),
    });

  async function completeInitialOnboarding() {
    expect(await completeStep("profile", "2026-10-09T00:00:00.000Z")).toMatchObject({
      status: "completed",
      onboardingCompleted: false,
      state: { isCompleted: false },
    });
    expect(await completeStep("invite", "2026-10-09T00:01:00.000Z")).toMatchObject({
      status: "completed",
      onboardingCompleted: true,
      state: { isCompleted: true },
    });
  }

  it.each<{ name: string; steps: OnboardingState["steps"] }>([
    { name: "empty steps", steps: {} },
    {
      name: "explicit incomplete steps",
      steps: { profile: { completed: false }, invite: { completed: false } },
    },
  ])("emits only the new final transition after resetting to $name", async ({ steps }) => {
    await completeInitialOnboarding();
    await store.saveState(tenantId, userId, onboardingId, {
      steps,
      isCompleted: false,
    });

    expect(await completeStep("invite", "2026-10-09T00:02:00.000Z")).toMatchObject({
      status: "completed",
      onboardingCompleted: false,
      state: { isCompleted: false, steps: { invite: { completed: true } } },
    });
    expect(await completeStep("profile", "2026-10-09T00:03:00.000Z")).toMatchObject({
      status: "completed",
      onboardingCompleted: true,
      state: { isCompleted: true },
    });
    expect(await completeStep("profile", "2026-10-09T00:04:00.000Z")).toEqual({
      status: "already_completed",
    });
    expect(await completeStep("invite", "2026-10-09T00:05:00.000Z")).toEqual({
      status: "already_completed",
    });
  });

  it("preserves the completion identity when saving completed state", async () => {
    await completeInitialOnboarding();
    const completedAt = new Date("2026-10-09T00:01:00.000Z");
    await store.saveState(tenantId, userId, onboardingId, {
      steps: {
        profile: { completed: true, completedAt: new Date("2026-10-09T00:00:00.000Z") },
        invite: { completed: true, completedAt },
      },
      isCompleted: true,
      completedAt,
    });

    const rows = await pool.query<{ completion_step_id: string }>(
      "select completion_step_id from onboarding_states where tenant_id = $1 and user_id = $2 and onboarding_id = $3",
      [tenantId, userId, onboardingId],
    );
    expect(rows.rows).toEqual([{ completion_step_id: "invite" }]);
    expect(await completeStep("invite", "2026-10-09T00:02:00.000Z")).toEqual({
      status: "already_completed",
    });
  });

  const completedAt = new Date("2026-01-01T00:05:00.123Z");

  it.each(["insert", "update"] as const)(
    "preserves the input instant on %s completion",
    async (path) => {
      const requiredStepIds = path === "insert" ? ["invite"] : ["profile", "invite"];
      if (path === "update") {
        const first = await store.completeStep("tenant-1", "user-1", "setup", {
          stepId: "profile",
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          requiredStepIds,
        });
        expect(first).toMatchObject({ status: "completed", state: { isCompleted: false } });
        expect((await store.getState("tenant-1", "user-1", "setup"))?.completedAt).toBeUndefined();
      }

      const result = await store.completeStep("tenant-1", "user-1", "setup", {
        stepId: "invite",
        completedAt,
        requiredStepIds,
      });
      expect(result).toMatchObject({
        status: "completed",
        state: { isCompleted: true, completedAt },
      });
      const state = await store.getState("tenant-1", "user-1", "setup");
      expect(state?.completedAt).toEqual(completedAt);
      expect(state?.steps.invite?.completedAt).toEqual(completedAt);

      await expect(
        store.completeStep("tenant-1", "user-1", "setup", {
          stepId: "invite",
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          requiredStepIds,
        }),
      ).resolves.toEqual({ status: "already_completed" });
      await store.completeStep("tenant-1", "user-1", "setup", {
        stepId: "optional",
        completedAt: new Date("2026-01-03T00:00:00.000Z"),
        requiredStepIds,
      });
      expect((await store.getState("tenant-1", "user-1", "setup"))?.completedAt).toEqual(
        completedAt,
      );
    },
  );
});
