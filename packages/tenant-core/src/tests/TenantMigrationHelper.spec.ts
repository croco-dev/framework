import { describe, expect, it } from "vitest";
import { createTenantMigrationPlan, renderTenantMigrationPlan } from "../tenant-model";

describe("TenantMigrationHelper", () => {
  it("reports no manual work when the tenant model is unchanged", () => {
    const plan = createTenantMigrationPlan("org", "org");

    expect(plan).toEqual({
      from: "org",
      to: "org",
      risk: "none",
      manualSteps: ["No tenant model migration is required."],
      warnings: [],
    });
  });

  it("emits manual steps and warnings for unsafe shared-schema migrations", () => {
    const plan = createTenantMigrationPlan("single", "shared-schema");

    expect(plan.risk).toBe("high");
    expect(plan.manualSteps).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Inventory existing tenant-owned resources"),
        expect.stringContaining("Backfill tenant ids"),
        expect.stringContaining("tenant isolation fixtures"),
      ]),
    );
    expect(plan.warnings).toEqual([
      expect.objectContaining({
        code: "tenant-core/tenant-model-manual-migration-required",
        message: expect.stringContaining("nullable tenant discriminator"),
      }),
      expect.objectContaining({
        code: "tenant-core/tenant-model-manual-migration-required",
        message: expect.stringContaining("Global tables"),
      }),
    ]);
  });

  it("renders migration output for generated playbooks and operator review", () => {
    const rendered = renderTenantMigrationPlan(createTenantMigrationPlan("org", "rls-backed"));

    expect(rendered).toContain("Tenant model migration: org -> rls-backed");
    expect(rendered).toContain("Risk: high");
    expect(rendered).toContain("1. Inventory existing tenant-owned resources");
    expect(rendered).toContain("tenant-core/tenant-model-manual-migration-required");
  });
});
