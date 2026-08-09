import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { runGenerateUsageDashboard } from "../commands/generateUsageDashboard.js";
import { CLI_DIAGNOSTIC_CODES, CLI_LEGACY_DIAGNOSTIC_CODES } from "../libs/diagnosticCodes.js";

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
    readonly usageBillingReadModel?: {
      getSnapshot(tenantId: string, meterIds: readonly string[]): Promise<unknown>;
    };
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
    expect(controllerContent).toContain('import { Component } from "@croco/framework-context";');
    expect(controllerContent).toContain("@Component()");
    expect(readGeneratedUsageDashboardRoute(controllerContent)).toEqual({
      controllerPath: "/ops",
      contractPath: "/ops/usage",
      methodDecorator: "usageDashboardSnapshotRoute",
      resolvedMethodPath: "/usage",
    });
    expect(controllerContent).toContain('import { ProblemCategory } from "@croco/problems-core";');
    expect(controllerContent).toContain("@ResponseSchema(usageDashboardSnapshotSchema)");
    expect(controllerContent).toContain("const usageDashboardSnapshotSchema = z.object");
    expect(controllerContent).toContain('await import("../usage-dashboard/UsageDashboardRuntime")');
    expect(controllerContent).toContain('const tenantId = ctx.header("x-tenant-id");');
    expect(controllerContent).toContain('throw new RequestValidationProblem("query", [');
    expect(controllerContent).toContain(
      '{ path: "tenantId", message: "Expected a single query value" },',
    );
    expect(controllerContent).toContain("return queryTenantId;");
    expect(controllerContent).not.toContain("queryTenantId[0]");
    expect(controllerContent).toContain("const values = (Array.isArray(value) ? value : [value])");
    assertGeneratedQueryHelpersTypecheck(controllerContent);
    expect(serviceContent).toContain("export type UsageDashboardSnapshot");
    expect(serviceContent).toContain("export type UsageDashboardBillingDeliverySnapshot");
    expect(serviceContent).toContain("readonly planVersionRef: string | null;");
    expect(serviceContent).toContain(
      "readonly billingDelivery: UsageDashboardBillingDeliverySnapshot | null;",
    );
    expect(serviceContent).toContain("return await readModel.getSnapshot(tenantId, meterIds)");
    expect(serviceContent).toContain('"near_quota"');
    expect(serviceContent).toContain("resolveOverageState");
    expect(serviceContent).toContain("return await this.dependencies.meterRegistry.getByTenant");
    expect(serviceContent).toContain('period: "billing_cycle"');
    expect(serviceContent).not.toContain("externalCustomerId");
    expect(serviceContent).not.toContain("externalSubscriptionId");
    expect(problemsContent).toContain("UsageDashboardTenantRequiredProblem");
    expect(problemsContent).toContain("UsageDashboardProviderUnavailableProblem");
    expect(problemsContent).toContain(
      'import { Problem, ProblemCategory } from "@croco/problems-core";',
    );
    expect(problemsContent).toContain(
      'import type { ProblemDetails, ProblemOptions } from "@croco/problems-core";',
    );
    expect(problemsContent).not.toContain("type ProblemDetails, type ProblemOptions");
    expect(problemsContent).toContain(CLI_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable);
    expect(problemsContent).toContain(
      CLI_LEGACY_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable,
    );
    expect(problemsContent).toContain("type UsageDashboardProblemJson = ProblemDetails");
    expect(problemsContent).toContain("options?: ProblemOptions");
    expect(problemsContent).toContain("toJSON(): UsageDashboardProblemJson");
    expect(problemsContent).toContain("return { ...super.toJSON(), legacyCode: this.legacyCode };");
    expect(problemsContent).not.toContain("usageDashboardProblemMetadata");
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
    expect(pageContent).toContain("<h2>Billing delivery</h2>");
    expect(pageContent).toContain("snapshot.billingDelivery.retryCount");
    expect(pageContent).toContain("snapshot.billingDelivery.terminalFailureCount");
    expect(pageContent).toContain("snapshot.billingDelivery.oldestPendingAgeMs");
    expect(pageContent).toContain("snapshot.billingDelivery.recoveryCommand");
    expect(routeContent).toContain("path: '/usage'");
  }, 30_000);

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

  it("registers in app.ts when the server entrypoint only starts the app", async () => {
    const cwd = await createWorkspace();
    await fs.writeFile(
      path.join(cwd, "apps", "api-server", "src", "app.ts"),
      `import { createApp } from '@croco/transports-http';
import { OperationsController } from './controllers/OperationsController';

const controllers = [OperationsController];

export function createCrocoDiGraphRoots() {
  return controllers;
}

export function createCrocoApp() {
  return createApp({
    controllers,
  });
}
`,
    );
    await fs.writeFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      `import { createCrocoApp } from './app';

const app = createCrocoApp();
await app.listen(3000);
`,
    );

    const result = await runGenerateUsageDashboard({ cwd, page: false });
    const appContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "app.ts"),
      "utf-8",
    );
    const indexContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      "utf-8",
    );

    expect(result?.api.registration.status).toBe("updated");
    expect(appContent).toContain(
      "import { UsageDashboardController } from './controllers/UsageDashboardController';",
    );
    expect(appContent).toContain(
      "const controllers = [OperationsController, UsageDashboardController];",
    );
    expect(indexContent).not.toContain("addControllers");
  });

  it("falls back to index.ts when app.ts only exposes DI graph roots", async () => {
    const cwd = await createWorkspace();
    await fs.writeFile(
      path.join(cwd, "apps", "api-server", "src", "app.ts"),
      `import { OperationsController } from './controllers/OperationsController';

const controllers = [OperationsController];

export function createCrocoDiGraphRoots() {
  return controllers;
}
`,
    );
    await fs.writeFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      `import { createApp } from '@croco/transports-http';
import { OperationsController } from './controllers/OperationsController';

const app = createApp({
  controllers: [OperationsController],
});

await app.listen(3000);
`,
    );

    const result = await runGenerateUsageDashboard({ cwd, page: false });
    const appContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "app.ts"),
      "utf-8",
    );
    const indexContent = await fs.readFile(
      path.join(cwd, "apps", "api-server", "src", "index.ts"),
      "utf-8",
    );

    expect(result?.api.registration.status).toBe("updated");
    expect(appContent).not.toContain("UsageDashboardController");
    expect(indexContent).toContain(
      "import { UsageDashboardController } from './controllers/UsageDashboardController';",
    );
    expect(indexContent).toContain("controllers: [OperationsController, UsageDashboardController]");
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

    expect(readGeneratedUsageDashboardRoute(controllerContent)).toEqual({
      controllerPath: "/admin/tenants",
      contractPath: "/admin/tenants/usage",
      methodDecorator: "usageDashboardSnapshotRoute",
      resolvedMethodPath: "/usage",
    });
    expect(routeContent).toContain("path: '/admin/usage'");
  });

  it("rejects invalid route paths with a stable diagnostic code", async () => {
    const cwd = await createWorkspace();

    await expect(runGenerateUsageDashboard({ cwd, apiPath: " " })).rejects.toMatchObject({
      code: CLI_DIAGNOSTIC_CODES.usageDashboardInvalidRoutePath,
    });
  });

  it("should reject missing generated API dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });

    await expect(runGenerateUsageDashboard({ cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/problems-core, @croco/billing-core, @croco/entitlements-core, @croco/metering-core, @croco/tenant-core, @croco/framework-context, @croco/protocols-rest, @croco/transports-http, zod.",
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
        code: CLI_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable,
        detail: expect.stringContaining("meter registry is unavailable: registry down"),
      });
      expect(typeof (caught as { toJSON?: unknown }).toJSON).toBe("function");
      expect((caught as { toJSON: () => unknown }).toJSON()).toMatchObject({
        code: CLI_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable,
        status: 500,
        legacyCode: CLI_LEGACY_DIAGNOSTIC_CODES.usageDashboardProviderUnavailable,
      });
    } finally {
      await fs.rm(cwd, { force: true, recursive: true });
    }
  });

  it("should expose version-pinned provider delivery drift from an optional read model", async () => {
    const cwd = await createWorkspace({
      consoleWeb: false,
      tempPrefix: path.join(process.cwd(), ".usage-dashboard-delivery-"),
    });

    try {
      await runGenerateUsageDashboard({ cwd });
      const usageDir = path.join(cwd, "apps", "api-server", "src", "usage-dashboard");
      const { UsageDashboardService } = await importGeneratedModule<GeneratedServiceModule>(
        path.join(usageDir, "UsageDashboardService.ts"),
      );
      const billingDelivery = {
        localUsage: 110,
        providerAcceptedUsage: 80,
        usageDrift: 30,
        backlogCount: 1,
        oldestPendingAgeMs: 1_000,
        retryCount: 1,
        terminalFailureCount: 0,
        recoveryCommand: "pnpm demo:scenario",
      };
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
            return {
              planId: "team",
              planVersionRef: "team@v1",
              status: "active",
              currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z"),
            };
          },
        },
        meterRegistry: {
          async getByTenant() {
            return [
              {
                tenantId: "tenant_acme",
                meterId: "api_requests",
                type: "COUNT",
                billing: "required",
                quota: 100,
                allowOverQuota: true,
                metadata: { unit: "request" },
              },
            ];
          },
        },
        meteringService: {
          async getUsage() {
            return 110;
          },
        },
        entitlementManager: {
          async check(_tenantId: string, featureKey: string) {
            return { featureKey, granted: false, type: "boolean" };
          },
        },
        usageBillingReadModel: {
          async getSnapshot() {
            return billingDelivery;
          },
        },
      });

      await expect(service.getSnapshot("tenant_acme")).resolves.toMatchObject({
        planVersionRef: "team@v1",
        billingDelivery,
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
        "@croco/framework-context",
        "@croco/metering-core",
        "@croco/problems-core",
        "@croco/protocols-rest",
        "@croco/tenant-core",
        "@croco/transports-http",
        "zod",
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

function readGeneratedUsageDashboardRoute(controllerContent: string): {
  readonly controllerPath: string;
  readonly contractPath: string;
  readonly methodDecorator: string;
  readonly resolvedMethodPath: string;
} {
  const controllerPath = readStringCapture(
    controllerContent,
    /@Controller\("([^"]+)"\)/,
    "controller path",
  );
  const contractPath = readStringCapture(
    controllerContent,
    /const usageDashboardSnapshotRoute = defineRouteContract\(\{[\s\S]*?path: "([^"]+)"/,
    "usage dashboard contract path",
  );
  const methodDecorator = readStringCapture(
    controllerContent,
    /@Get\(([A-Za-z0-9_]+)\)/,
    "usage dashboard method decorator",
  );

  return {
    controllerPath,
    contractPath,
    methodDecorator,
    resolvedMethodPath: resolveControllerRelativeRoutePath(controllerPath, contractPath),
  };
}

function readStringCapture(content: string, pattern: RegExp, label: string): string {
  const value = pattern.exec(content)?.[1];

  if (!value) {
    throw new Error(`Could not read generated ${label}.`);
  }

  return value;
}

function resolveControllerRelativeRoutePath(controllerPath: string, routePath: string): string {
  if (controllerPath === "") {
    return routePath === "/" ? "" : routePath;
  }

  if (routePath === controllerPath) {
    return "";
  }

  if (routePath.startsWith(`${controllerPath}/`)) {
    return routePath.slice(controllerPath.length);
  }

  return routePath;
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

function assertGeneratedQueryHelpersTypecheck(controllerContent: string): void {
  const helpersStart = controllerContent.indexOf("function readTenantId");
  expect(helpersStart).toBeGreaterThanOrEqual(0);

  const source = `type CrocoHttpContext = {
  header(name: string): string | undefined;
  query(name: string): string | string[] | undefined;
};

declare class RequestValidationProblem {
  constructor(source: "query", issues: Array<{ path: string; message: string }>);
}

${controllerContent.slice(helpersStart)}`;
  const fileName = path.join(process.cwd(), "generated-usage-dashboard-query-helpers.ts");
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const getSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (...args) => {
    const [requestedFileName, languageVersion] = args;

    if (requestedFileName === fileName) {
      return ts.createSourceFile(fileName, source, languageVersion, true);
    }

    return getSourceFile(...args);
  };

  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([fileName], compilerOptions, host));
  expect(
    diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
  ).toEqual([]);
}

async function importGeneratedModule<T>(filePath: string): Promise<T> {
  return (await import(pathToFileURL(filePath).href)) as T;
}
