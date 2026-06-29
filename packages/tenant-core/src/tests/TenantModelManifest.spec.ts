import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DEFAULT_TENANT_MODEL,
  TENANT_MODEL_NAMES,
  createTenantModelManifest,
  createTenantModelManifestSchema,
  getTenantModelDefinition,
  isTenantModelName,
  renderTenantModelPlaybook,
  type TenantModelManifest,
  type TenantModelName,
  validateTenantModelCompatibility,
} from "../tenant-model";

describe("TenantModelManifest", () => {
  it("exposes a stable default model and supported model union", () => {
    expect(DEFAULT_TENANT_MODEL).toBe("org");
    expect(TENANT_MODEL_NAMES).toEqual([
      "single",
      "org",
      "workspace",
      "shared-schema",
      "rls-backed",
    ]);
    expect(isTenantModelName("workspace")).toBe(true);
    expect(isTenantModelName("custom")).toBe(false);

    expectTypeOf<TenantModelName>().toEqualTypeOf<
      "single" | "org" | "workspace" | "shared-schema" | "rls-backed"
    >();
  });

  it("creates a JSON-safe manifest and schema from the same definitions", () => {
    const manifest = createTenantModelManifest("workspace");
    const schema = createTenantModelManifestSchema();

    expectTypeOf(manifest).toMatchTypeOf<TenantModelManifest>();
    expect(manifest).toMatchObject({
      schemaVersion: "croco.tenant-model/v1",
      currentModel: "workspace",
      defaultModel: "org",
      schema: {
        file: "croco-tenant-model.schema.json",
        version: "croco.tenant-model/v1",
      },
      selected: {
        name: "workspace",
        tenantKey: "workspaceId",
        requiredAdapters: [
          "TenantManager",
          "MembershipManager",
          "InvitationManager",
          "WorkspaceSelectionAdapter",
        ],
      },
    });
    expect(manifest.models.map((model) => model.name)).toEqual(TENANT_MODEL_NAMES);
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    expect(schema.properties.currentModel).toEqual({ enum: TENANT_MODEL_NAMES });
    expect(schema.properties.defaultModel).toEqual({ const: DEFAULT_TENANT_MODEL });
  });

  it("renders playbook content from the selected manifest", () => {
    const manifest = createTenantModelManifest("shared-schema");
    const playbook = renderTenantModelPlaybook(manifest);

    expect(playbook).toContain("# Tenant Model Playbook");
    expect(playbook).toContain("Current model: `shared-schema`");
    expect(playbook).toContain("| shared-schema | tenant-column | tenantId |");
    expect(playbook).toContain("TenantFilteredRepository");
    expect(playbook).toContain("tenant-core/tenant-model-manual-migration-required");
    expect(playbook).toContain("Tenant model migration: org -> shared-schema");
  });

  it("returns deterministic compatibility diagnostics for unsupported provider combinations", () => {
    const result = validateTenantModelCompatibility({
      tenantModel: "rls-backed",
      providerProfileName: "saas-cloudflare",
      runtimeTarget: "cloudflare-workers",
      packages: ["@croco/tenant-core", "@croco/tx-core"],
      capabilities: ["tenant-context", "tenant-identity"],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tenant-core/tenant-model-runtime-incompatible",
        }),
        expect.objectContaining({
          code: "tenant-core/tenant-model-package-missing",
          message: expect.stringContaining("@croco/tx-drizzle"),
        }),
        expect.objectContaining({
          code: "tenant-core/tenant-model-capability-missing",
          message: expect.stringContaining("postgres-rls"),
        }),
      ]),
    );
  });

  it("accepts the default SaaS organization model with generated app packages", () => {
    const definition = getTenantModelDefinition("org");
    const result = validateTenantModelCompatibility({
      tenantModel: "org",
      providerProfileName: "saas-node-postgres",
      runtimeTarget: "node",
      packages: definition.requiredPackages,
      capabilities: definition.requiredCapabilities,
    });

    expect(result).toEqual({
      ok: true,
      diagnostics: [],
    });
  });
});
