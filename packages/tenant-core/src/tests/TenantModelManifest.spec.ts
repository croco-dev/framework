import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DEFAULT_TENANT_MODEL,
  SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS,
  TENANT_MODEL_MANIFEST_SCHEMA_ID,
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
    expect(manifest.compatibility).toMatchObject({
      schemaId: TENANT_MODEL_MANIFEST_SCHEMA_ID,
      currentVersion: "croco.tenant-model/v1",
      supportedVersions: SUPPORTED_TENANT_MODEL_MANIFEST_SCHEMA_VERSIONS,
      generatedArtifacts: {
        manifest: "croco-tenant-model.manifest.json",
        schema: "croco-tenant-model.schema.json",
        playbook: "docs/tenant-model-playbook.md",
        source: "apps/api-server/src/generatedTenantModel.ts",
      },
    });
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
    expect(schema.properties.currentModel).toEqual({ enum: TENANT_MODEL_NAMES });
    expect(schema.properties.defaultModel).toEqual({ const: DEFAULT_TENANT_MODEL });
    expect(manifest).toMatchInlineSnapshot(`
      {
        "compatibility": {
          "currentVersion": "croco.tenant-model/v1",
          "generatedArtifacts": {
            "manifest": "croco-tenant-model.manifest.json",
            "playbook": "docs/tenant-model-playbook.md",
            "schema": "croco-tenant-model.schema.json",
            "source": "apps/api-server/src/generatedTenantModel.ts",
          },
          "migration": {
            "guidance": [
              "Bump schemaVersion only when existing tenant manifest consumers cannot safely read the new shape.",
              "Ship migration guidance before generated apps start emitting the new tenant manifest version.",
              "Run profile:check and croco doctor on generated apps before accepting the version change.",
            ],
            "requiredForVersionChange": true,
          },
          "rules": [
            "croco.tenant-model/v1 changes must be additive for existing fields.",
            "Removing or renaming tenant model fields requires a new schemaVersion and migration notes.",
            "Generated croco-tenant-model.manifest.json, croco-tenant-model.schema.json, docs/tenant-model-playbook.md, and generatedTenantModel.ts must be committed together.",
          ],
          "schemaId": "https://croco.dev/schemas/tenant-model-manifest.v1.json",
          "supportedVersions": [
            "croco.tenant-model/v1",
          ],
        },
        "currentModel": "workspace",
        "defaultModel": "org",
        "diagnostics": [
          {
            "code": "tenant-core/tenant-model-manual-migration-required",
            "message": "Moving historical rows between workspaces can change entitlement and audit semantics.",
            "recovery": "Write an explicit migration runbook, backfill evidence, and rollback plan before changing production tenant isolation.",
            "severity": "warning",
          },
        ],
        "migration": {
          "from": "org",
          "manualSteps": [
            "Inventory existing tenant-owned resources before changing the manifest from 'org' to 'workspace'.",
            "Choose a deterministic default workspace for each existing organization.",
            "Backfill workspace ids onto tenant-owned resources before exposing workspace switching.",
            "Keep an audit trail for rows moved between workspaces.",
            "Run generated contract checks and tenant isolation fixtures before accepting writes in the new model.",
            "Commit the updated croco-tenant-model.manifest.json and docs/tenant-model-playbook.md together.",
          ],
          "risk": "low",
          "to": "workspace",
          "warnings": [
            {
              "code": "tenant-core/tenant-model-manual-migration-required",
              "message": "Moving historical rows between workspaces can change entitlement and audit semantics.",
              "recovery": "Write an explicit migration runbook, backfill evidence, and rollback plan before changing production tenant isolation.",
            },
          ],
        },
        "models": [
          {
            "displayName": "Single tenant",
            "isolation": "none",
            "migrationHints": [
              "Create one tenant record that represents the current deployment.",
              "Backfill future tenant-owned rows with that tenant id before enabling scoped queries.",
            ],
            "name": "single",
            "requiredAdapters": [
              "TenantManager",
            ],
            "requiredCapabilities": [
              "tenant-context",
              "migration-plan",
            ],
            "requiredPackages": [
              "@croco/tenant-core",
            ],
            "schemaHints": [
              "Do not add tenant discriminator columns to domain tables.",
              "Keep admin-only data export available so the app can move to an org or workspace model later.",
            ],
            "summary": "One logical tenant for the whole application. Use this while product-market fit matters more than tenant administration.",
            "supportedRuntimeTargets": [
              "node",
              "cloudflare-workers",
              "lambda",
            ],
            "tenantKey": "none",
            "unsafeMigrationWarnings": [],
          },
          {
            "displayName": "Organization",
            "isolation": "membership",
            "migrationHints": [
              "Create organization records for each existing account owner or billing account.",
              "Backfill memberships before enforcing tenant-required routes.",
              "Run cross-tenant leak fixtures before removing single-tenant fallbacks.",
            ],
            "name": "org",
            "requiredAdapters": [
              "TenantManager",
              "MembershipManager",
              "InvitationManager",
            ],
            "requiredCapabilities": [
              "tenant-context",
              "tenant-identity",
              "membership",
              "migration-plan",
            ],
            "requiredPackages": [
              "@croco/tenant-core",
              "@croco/membership-core",
              "@croco/invitation-core",
            ],
            "schemaHints": [
              "Create an organizations table or provider-backed organization mapping.",
              "Store membership and invitation records by organization id.",
              "Bind request context from an explicit organization selector, auth claim, header, or route segment.",
            ],
            "summary": "A SaaS organization owns memberships, invitations, billing, and default tenant context for most B2B apps.",
            "supportedRuntimeTargets": [
              "node",
              "cloudflare-workers",
              "lambda",
            ],
            "tenantKey": "organizationId",
            "unsafeMigrationWarnings": [
              "Do not infer organization ownership only from email domains without an explicit admin review.",
            ],
          },
          {
            "displayName": "Workspace",
            "isolation": "membership",
            "migrationHints": [
              "Choose a deterministic default workspace for each existing organization.",
              "Backfill workspace ids onto tenant-owned resources before exposing workspace switching.",
              "Keep an audit trail for rows moved between workspaces.",
            ],
            "name": "workspace",
            "requiredAdapters": [
              "TenantManager",
              "MembershipManager",
              "InvitationManager",
              "WorkspaceSelectionAdapter",
            ],
            "requiredCapabilities": [
              "tenant-context",
              "tenant-identity",
              "membership",
              "workspace-selection",
              "migration-plan",
            ],
            "requiredPackages": [
              "@croco/tenant-core",
              "@croco/membership-core",
              "@croco/invitation-core",
            ],
            "schemaHints": [
              "Create workspaces beneath organizations or accounts.",
              "Persist the active workspace id separately from user authentication state.",
              "Scope feature flags, entitlement checks, and generated RPC clients to the active workspace.",
            ],
            "summary": "A user can belong to multiple workspaces inside an organization. Use this when collaboration spaces need isolated configuration or data.",
            "supportedRuntimeTargets": [
              "node",
              "cloudflare-workers",
              "lambda",
            ],
            "tenantKey": "workspaceId",
            "unsafeMigrationWarnings": [
              "Moving historical rows between workspaces can change entitlement and audit semantics.",
            ],
          },
          {
            "displayName": "Shared schema",
            "isolation": "tenant-column",
            "migrationHints": [
              "Classify every table as global, tenant-owned, or join data before adding columns.",
              "Backfill tenant ids in a locked or dual-write phase.",
              "Fail reads and writes that omit tenant predicates.",
            ],
            "name": "shared-schema",
            "requiredAdapters": [
              "TenantContextProvider",
              "TenantFilteredRepository",
            ],
            "requiredCapabilities": [
              "tenant-context",
              "tenant-identity",
              "tenant-discriminator",
              "tenant-query-filter",
              "migration-plan",
            ],
            "requiredPackages": [
              "@croco/tenant-core",
              "@croco/tx-core",
            ],
            "schemaHints": [
              "Add a non-null tenant id column to every tenant-owned table.",
              "Index tenant id with hot-path lookup keys.",
              "Require repository/query helpers to prove tenant predicates before execution.",
            ],
            "summary": "All tenants share the same database schema and every tenant-owned table carries a tenant discriminator column.",
            "supportedRuntimeTargets": [
              "node",
              "cloudflare-workers",
              "lambda",
            ],
            "tenantKey": "tenantId",
            "unsafeMigrationWarnings": [
              "A nullable tenant discriminator is an unsafe intermediate state unless writes are frozen.",
              "Global tables must be explicitly marked global instead of silently skipping tenant checks.",
            ],
          },
          {
            "displayName": "RLS-backed",
            "isolation": "postgres-rls",
            "migrationHints": [
              "Add tenant id columns and indexes before enabling RLS.",
              "Create policies in report-only or locked maintenance windows first.",
              "Verify adapter-provided TenantRlsEvidence matches the active tenant before release.",
            ],
            "name": "rls-backed",
            "requiredAdapters": [
              "TenantContextProvider",
              "DrizzleTenantSession",
              "TenantRlsEvidence",
            ],
            "requiredCapabilities": [
              "tenant-context",
              "tenant-identity",
              "tenant-discriminator",
              "tenant-query-filter",
              "postgres-rls",
              "migration-plan",
            ],
            "requiredPackages": [
              "@croco/tenant-core",
              "@croco/tx-core",
              "@croco/tx-drizzle",
              "drizzle-orm",
            ],
            "schemaHints": [
              "Use Postgres tables with non-null tenant id columns for tenant-owned rows.",
              "Set the current tenant through a transaction-scoped database setting before queries run.",
              "Enable and force RLS policies before treating the provider as production-ready.",
            ],
            "summary": "Postgres row-level security enforces tenant isolation in the database in addition to application-level tenant context.",
            "supportedRuntimeTargets": [
              "node",
            ],
            "tenantKey": "tenantId",
            "unsafeMigrationWarnings": [
              "Do not enable RLS without proving every write path sets the current tenant database setting.",
              "Do not deploy RLS-backed mode on runtimes without a Postgres transaction boundary.",
            ],
          },
        ],
        "qualityGates": [
          "profile:check",
          "contract:verify",
          "demo:smoke",
        ],
        "schema": {
          "file": "croco-tenant-model.schema.json",
          "version": "croco.tenant-model/v1",
        },
        "schemaVersion": "croco.tenant-model/v1",
        "selected": {
          "displayName": "Workspace",
          "isolation": "membership",
          "migrationHints": [
            "Choose a deterministic default workspace for each existing organization.",
            "Backfill workspace ids onto tenant-owned resources before exposing workspace switching.",
            "Keep an audit trail for rows moved between workspaces.",
          ],
          "name": "workspace",
          "requiredAdapters": [
            "TenantManager",
            "MembershipManager",
            "InvitationManager",
            "WorkspaceSelectionAdapter",
          ],
          "requiredCapabilities": [
            "tenant-context",
            "tenant-identity",
            "membership",
            "workspace-selection",
            "migration-plan",
          ],
          "requiredPackages": [
            "@croco/tenant-core",
            "@croco/membership-core",
            "@croco/invitation-core",
          ],
          "schemaHints": [
            "Create workspaces beneath organizations or accounts.",
            "Persist the active workspace id separately from user authentication state.",
            "Scope feature flags, entitlement checks, and generated RPC clients to the active workspace.",
          ],
          "summary": "A user can belong to multiple workspaces inside an organization. Use this when collaboration spaces need isolated configuration or data.",
          "supportedRuntimeTargets": [
            "node",
            "cloudflare-workers",
            "lambda",
          ],
          "tenantKey": "workspaceId",
          "unsafeMigrationWarnings": [
            "Moving historical rows between workspaces can change entitlement and audit semantics.",
          ],
        },
      }
    `);
    expect(schema).toMatchInlineSnapshot(`
      {
        "$id": "https://croco.dev/schemas/tenant-model-manifest.v1.json",
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "properties": {
          "compatibility": {
            "required": [
              "schemaId",
              "currentVersion",
              "supportedVersions",
              "rules",
              "generatedArtifacts",
              "migration",
            ],
            "type": "object",
          },
          "currentModel": {
            "enum": [
              "single",
              "org",
              "workspace",
              "shared-schema",
              "rls-backed",
            ],
          },
          "defaultModel": {
            "const": "org",
          },
          "migration": {
            "required": [
              "from",
              "to",
              "risk",
              "manualSteps",
              "warnings",
            ],
            "type": "object",
          },
          "models": {
            "minItems": 5,
            "type": "array",
          },
          "schemaVersion": {
            "const": "croco.tenant-model/v1",
          },
          "selected": {
            "required": [
              "name",
              "displayName",
              "summary",
              "tenantKey",
              "isolation",
              "requiredPackages",
              "requiredAdapters",
              "requiredCapabilities",
              "supportedRuntimeTargets",
              "schemaHints",
              "migrationHints",
              "unsafeMigrationWarnings",
            ],
            "type": "object",
          },
        },
        "required": [
          "schemaVersion",
          "currentModel",
          "defaultModel",
          "selected",
          "models",
          "migration",
          "compatibility",
        ],
        "title": "Croco Tenant Model Manifest",
        "type": "object",
      }
    `);
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
    expect(playbook).toContain("## Manifest Versioning");
    expect(playbook).toContain("Current version: `croco.tenant-model/v1`");
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
