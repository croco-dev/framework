import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingMigrationClient } from "../migrations/addCompletionStepIdentity";
import {
  addOnboardingLifecycleFields,
  removeOnboardingLifecycleFields,
} from "../migrations/addOnboardingLifecycleFields";

describe("onboarding lifecycle field migrations", () => {
  const dialect = new PgDialect();
  const normalize = (statement: string) => statement.replace(/\s+/g, " ").trim();

  beforeEach(() => {
    Container.reset();
  });

  it("adds nullable lifecycle columns without compatibility defaults", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);

    await addOnboardingLifecycleFields({ execute } as OnboardingMigrationClient);

    const statement = normalize(dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL).sql);
    expect(statement).toBe(
      "ALTER TABLE onboarding_states ADD COLUMN IF NOT EXISTS status text, " +
        "ADD COLUMN IF NOT EXISTS started_at timestamp, " +
        "ADD COLUMN IF NOT EXISTS current_step_id text",
    );
    expect(statement).not.toContain("NOT NULL");
    expect(statement).not.toContain("DEFAULT");
  });

  it("removes lifecycle columns in reverse order", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);

    await removeOnboardingLifecycleFields({ execute } as OnboardingMigrationClient);

    expect(normalize(dialect.sqlToQuery(execute.mock.calls[0]?.[0] as SQL).sql)).toBe(
      "ALTER TABLE onboarding_states DROP COLUMN IF EXISTS current_step_id, " +
        "DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS status",
    );
  });
});
