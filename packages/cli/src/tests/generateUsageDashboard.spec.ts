import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { runGenerateUsageDashboard } from "../commands/generateUsageDashboard.js";

type GeneratedUsageDashboardService = {
  getSnapshot(tenantIdInput: string | null | undefined): Promise<unknown>;
};

type GeneratedServiceModule = {
  UsageDashboardService: new (dependencies: {
    readonly tenantStore: { findById(id: string): Promise<unknown> };
    readonly billingService: { getSubscription(tenantId: string): Promise<unknown> };
    readonly meterRegistry: { getByTenant(tenantId: string): Promise<readonly unknown[]> };
    readonly meteringService: { getUsage(options: unknown): Promise<number> };
    readonly entitlementManager: { check(tenantId: string, featureKey: string): Promise<unknown> };
  }) => GeneratedUsageDashboardService;
};

describe("runGenerateUsageDashboard", () => {
  it("should create a usage dashboard API and console page", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateUsageDashboard({ cwd });
    const usageDir = path.join(cwd, "apps", "api-server", "src", "usage-dashboard");
    const controllerPath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "controllers",
      "UsageDashboardController.ts",
    );
    const serviceContent = await fs.readFile(
      path.join(usageDir, "UsageDashboardService.ts"),
      "utf-8",
    );
    const problemsContent = await fs.readFile(
      path.join(usageDir, "UsageDashboardProblems.ts"),
      "utf-8",
    );
    const controllerContent = await fs.readFile(controllerPath, "utf-8");
    const appContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "app.ts"),
      "utf-8",
    );
    const pageContent = await fs.readFile(
      path.join(cwd, "apps", "console-web", "pages", "usage", "Page.tsx"),
      "utf-8",
    );
    const runtimeContent = await fs.readFile(
      path.join(usageDir, "UsageDashboardRuntime.ts"),
      "utf-8",
    );
    const routeContent = await fs.readFile(
      path.join(cwd, "apps", "console-web", "pages", "usage", "route.ts"),
      "utf-8",
    );

    expect(result?.api.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.api.registration.status).toBe("updated");
    expect(result?.page?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(controllerContent).toContain('@Controller("/ops")');
    expect(controllerContent).toContain('@Get("/usage")');
    expect(controllerContent).toContain('await import("../usage-dashboard/UsageDashboardRuntime")');
    expect(controllerContent).toContain('ctx.header("x-tenant-id") ?? ctx.query("tenantId")');
    expect(serviceContent).toContain("export type UsageDashboardSnapshot");
    expect(serviceContent).toContain('"near_quota"');
    expect(serviceContent).toContain("resolveOverageState");
    expect(serviceContent).toContain("return await this.dependencies.meterRegistry.getByTenant");
    expect(serviceContent).toContain('period: "billing_cycle"');
    expect(serviceContent).not.toContain("externalCustomerId");
    expect(serviceContent).not.toContain("externalSubscriptionId");
    expect(problemsContent).toContain("UsageDashboardTenantRequiredProblem");
    expect(problemsContent).toContain("UsageDashboardProviderUnavailableProblem");
    expect(problemsContent).toContain("type ProblemOptions");
    expect(runtimeContent).toContain("formatRuntimeImportError(error)");
    expect(runtimeContent).toContain("{ cause: error }");
    expect(appContent).toContain(
      "import { UsageDashboardController } from './controllers/UsageDashboardController';",
    );
    expect(appContent).toContain("controllers: [OperationsController, UsageDashboardController]");
    expect(pageContent).toContain("const API_PATH = '/ops/usage';");
    expect(pageContent).toContain("typeof window === 'undefined'");
    expect(pageContent).toContain("Loading usage");
    expect(pageContent).toContain("meter needs quota attention");
    expect(routeContent).toContain("path: '/usage'");
  });

  it("should support API-only workspaces", async () => {
    const cwd = await createWorkspace({ consoleWeb: false });

    const result = await runGenerateUsageDashboard({ cwd });

    expect(result?.api.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.page).toBeNull();
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "usage", "Page.tsx")),
    ).rejects.toThrow();
  });

  it("should respect no-page mode when console web exists", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateUsageDashboard({ cwd, page: false });

    expect(result?.page).toBeNull();
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "usage", "Page.tsx")),
    ).rejects.toThrow();
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateUsageDashboard({ cwd, dryRun: true });

    expect(result?.api.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    expect(result?.page?.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    await expect(
      fs.access(
        path.join(cwd, "apps", "api-server", "src", "controllers", "UsageDashboardController.ts"),
      ),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "usage", "Page.tsx")),
    ).rejects.toThrow();
    expect(await readApiEntry(cwd)).not.toContain("UsageDashboardController");
  });

  it("should skip then overwrite existing generated files", async () => {
    const cwd = await createWorkspace();

    await runGenerateUsageDashboard({ cwd });
    const skipped = await runGenerateUsageDashboard({ cwd });
    const overwritten = await runGenerateUsageDashboard({ cwd, overwrite: true });

    expect(skipped?.api.files.map((file) => file.status)).toEqual([
      "exists-no-overwrite",
      "exists-no-overwrite",
      "exists-no-overwrite",
      "exists-no-overwrite",
      "exists-no-overwrite",
    ]);
    expect(skipped?.page?.files.map((file) => file.status)).toEqual([
      "exists-no-overwrite",
      "exists-no-overwrite",
    ]);
    expect(overwritten?.api.files.map((file) => file.status)).toEqual([
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
    ]);
    expect(overwritten?.api.registration.status).toBe("updated-idempotent");
  });

  it("should apply custom route paths", async () => {
    const cwd = await createWorkspace();

    await runGenerateUsageDashboard({
      cwd,
      apiPath: "/admin/tenants/usage",
      pagePath: "/admin/usage",
    });
    const controllerContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "controllers", "UsageDashboardController.ts"),
      "utf-8",
    );
    const routeContent = await fs.readFile(
      path.join(cwd, "apps", "console-web", "pages", "usage", "route.ts"),
      "utf-8",
    );

    expect(controllerContent).toContain('@Controller("/admin/tenants")');
    expect(controllerContent).toContain('@Get("/usage")');
    expect(routeContent).toContain("path: '/admin/usage'");
  });

  it("should reject missing generated API dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });

    await expect(runGenerateUsageDashboard({ cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/problems-core, @croco/billing-core, @croco/entitlements-core, @croco/metering-core, @croco/tenant-core, @croco/protocols-rest, @croco/transports-http.",
    );
    await expect(
      fs.access(
        path.join(cwd, "apps", "api-server", "src", "controllers", "UsageDashboardController.ts"),
      ),
    ).rejects.toThrow();
  });

  it("should wrap async meter registry failures in generated provider problems", async () => {
    const cwd = await createWorkspace({
      consoleWeb: false,
      tempPrefix: path.join(process.cwd(), ".usage-dashboard-runtime-"),
    });

    try {
      await runGenerateUsageDashboard({ cwd });
      const usageDir = path.join(cwd, "apps", "api-server", "src", "usage-dashboard");
      const { UsageDashboardService } = await importGeneratedModule<GeneratedServiceModule>(
        path.join(usageDir, "UsageDashboardService.ts"),
      );
      const service = new UsageDashboardService({
        tenantStore: {
          async findById() {
            return {
              id: "tenant_acme",
              slug: "acme",
              name: "Acme",
              status: "trial",
              settings: { features: [] },
            };
          },
        },
        billingService: {
          async getSubscription() {
            return null;
          },
        },
        meterRegistry: {
          async getByTenant() {
            throw new Error("registry down");
          },
        },
        meteringService: {
          async getUsage() {
            return 0;
          },
        },
        entitlementManager: {
          async check(_tenantId: string, featureKey: string) {
            return {
              featureKey,
              granted: false,
              type: "boolean",
            };
          },
        },
      });

      let caught: unknown;
      try {
        await service.getSnapshot("tenant_acme");
      } catch (error) {
        caught = error;
      }

      expect(caught).toMatchObject({
        name: "UsageDashboardProviderUnavailableProblem",
        code: "usage-dashboard/provider-unavailable",
        detail: expect.stringContaining("meter registry is unavailable: registry down"),
      });
    } finally {
      await fs.rm(cwd, { force: true, recursive: true });
    }
  });
});

async function createWorkspace(
  options: {
    apiServerManifest?: string;
    consoleWeb?: boolean;
    tempPrefix?: string;
  } = {},
): Promise<string> {
  const { consoleWeb = true } = options;
  const cwd = await fs.mkdtemp(
    options.tempPrefix ?? path.join(os.tmpdir(), "croco-cli-usage-dashboard-"),
  );

  await fs.mkdir(path.join(cwd, "apps", "api-server", "src", "controllers"), {
    recursive: true,
  });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ??
      packageManifest([
        "@croco/billing-core",
        "@croco/entitlements-core",
        "@croco/metering-core",
        "@croco/problems-core",
        "@croco/protocols-rest",
        "@croco/tenant-core",
        "@croco/transports-http",
      ]),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "src", "app.ts"),
    `import { createApp } from '@croco/transports-http';
import { OperationsController } from './controllers/OperationsController';

export function createCrocoApp() {
  return createApp({
    controllers: [OperationsController],
  });
}
`,
  );

  if (consoleWeb) {
    await fs.mkdir(path.join(cwd, "apps", "console-web"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "apps", "console-web", "package.json"),
      packageManifest(["@croco/meta-vite", "react"]),
    );
  }

  return cwd;
}

async function readApiEntry(cwd: string): Promise<string> {
  return fs.readFile(path.join(cwd, "apps", "api-server", "src", "app.ts"), "utf-8");
}

function packageManifest(packageNames: readonly string[]): string {
  return JSON.stringify(
    {
      dependencies: Object.fromEntries(
        packageNames.map((packageName) => [packageName, "workspace:*"]),
      ),
    },
    null,
    2,
  );
}

async function importGeneratedModule<T>(filePath: string): Promise<T> {
  return (await import(pathToFileURL(filePath).href)) as T;
}
