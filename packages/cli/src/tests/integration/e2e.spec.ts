import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runCreateDomain } from "../../commands/createDomain.js";
import { runCreatePage } from "../../commands/createPage.js";
import { generateController } from "../../commands/makeController.js";
import { generateEntity } from "../../commands/makeEntity.js";
import { generateEvent } from "../../commands/makeEvent.js";
import { generateListener } from "../../commands/makeListener.js";
import { generateRepository } from "../../commands/makeRepository.js";
import { runGenerateScaffold } from "../../commands/generateScaffold.js";
import { runGenerateUsageDashboard } from "../../commands/generateUsageDashboard.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const tmpRoots: string[] = [];

describe("container-fullstack generator e2e", () => {
  afterEach(async () => {
    await Promise.all(
      tmpRoots.splice(0).map((tmpRoot) => fs.rm(tmpRoot, { recursive: true, force: true })),
    );
  });

  it("should create a domain and register its controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("UserProfile", { cwd });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "user-profile");
    const entryContent = await readApiEntry(cwd);

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration?.status).toBe("updated");
    await expect(
      fs.access(path.join(domainDir, "UserProfileController.ts")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "UserProfileService.ts"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(domainDir, "UserProfileRepository.ts")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "UserProfileEntity.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(domainDir, "index.ts"))).resolves.toBeUndefined();
    expect(entryContent).toContain(
      "import { UserProfileController } from './domains/user-profile/UserProfileController';",
    );
    expect(entryContent).toContain("app.addControllers([UserProfileController]);");
  });

  it("should create an SSR page", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("Dashboard", { cwd, mode: "ssr" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "dashboard");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(pageContent).toContain("export default function DashboardPage");
    expect(routeContent).toContain("defineRoute");
    expect(routeContent).toContain("satisfies PageRouteDefinition");
    expect(routeContent).toContain("path: '/dashboard'");
  });

  it("should create an explicit SPA legacy frontend-vite page", async () => {
    const cwd = await createWorkspace();

    const result = await runCreatePage("SettingsPanel", { cwd, mode: "spa" });
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "settings-panel");
    const pageContent = await fs.readFile(path.join(pageDir, "Page.tsx"), "utf-8");
    const routeContent = await fs.readFile(path.join(pageDir, "route.ts"), "utf-8");

    expect(result?.files.map((file) => file.status)).toEqual(["created", "created"]);
    expect(pageContent).toContain("export default function SettingsPanelPage");
    expect(routeContent).toContain("Component: Page");
    expect(routeContent).toContain("routeConfig");
    expect(routeContent).not.toContain("defineRoute");
    expect(routeContent).not.toContain("react-router");
  });

  it("should create a domain and page scaffold", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateScaffold("Product", { cwd, mode: "spa" });
    const domainDir = path.join(cwd, "apps", "api-server", "src", "domains", "product");
    const pageDir = path.join(cwd, "apps", "console-web", "pages", "product");
    const entryContent = await readApiEntry(cwd);

    expect(result.domain?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result.domain?.registration?.status).toBe("updated");
    expect(result.page?.files.map((file) => file.status)).toEqual(["created", "created"]);
    await expect(fs.access(path.join(domainDir, "ProductController.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(pageDir, "Page.tsx"))).resolves.toBeUndefined();
    expect(entryContent).toContain("app.addControllers([ProductController]);");
  });

  it("should create a domain without registering its controller", async () => {
    const cwd = await createWorkspace();

    const result = await runCreateDomain("Invoice", { cwd, register: false });
    const entryContent = await readApiEntry(cwd);

    expect(result?.files.map((file) => file.status)).toEqual([
      "created",
      "created",
      "created",
      "created",
      "created",
    ]);
    expect(result?.registration).toBeNull();
    expect(entryContent).not.toContain("InvoiceController");
  });

  it("should overwrite existing generated files", async () => {
    const cwd = await createWorkspace();

    await runCreateDomain("Account", { cwd });
    const result = await runCreateDomain("Account", { cwd, overwrite: true });

    expect(result?.files.map((file) => file.status)).toEqual([
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
      "overwritten",
    ]);
    expect(result?.registration?.status).toBe("updated-idempotent");
  });

  it("should skip file creation in dry-run mode", async () => {
    const cwd = await createWorkspace();

    const result = await runGenerateScaffold("Report", { cwd, dryRun: true });

    expect(result.domain?.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    expect(result.domain?.registration?.status).toBe("updated");
    expect(result.page?.files.map((file) => file.status)).toEqual([
      "skipped-dry-run",
      "skipped-dry-run",
    ]);
    await expect(
      fs.access(
        path.join(cwd, "apps", "api-server", "src", "domains", "report", "ReportController.ts"),
      ),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(cwd, "apps", "console-web", "pages", "report", "Page.tsx")),
    ).rejects.toThrow();
    expect(await readApiEntry(cwd)).not.toContain("ReportController");
  });

  it("should typecheck representative generated command output", async () => {
    const cwd = await createWorkspace();

    await generateController("Account", { cwd });
    await runCreateDomain("Product", { cwd });
    await generateEntity("Order", { cwd });
    await generateRepository("Order", { cwd });
    await generateEvent("OrderCreated", { cwd });
    await generateListener("OrderCreated", { cwd });
    await runGenerateUsageDashboard({ cwd });
    await runCreatePage("Dashboard", { cwd, mode: "ssr" });
    await runCreatePage("SettingsPanel", { cwd, mode: "spa" });

    const typeDeclarationsPath = path.join(cwd, "generated-contracts.d.ts");
    await fs.writeFile(typeDeclarationsPath, generatedContractDeclarations());
    const tsconfigPath = path.join(cwd, "tsconfig.generated.json");
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            experimentalDecorators: true,
            jsx: "preserve",
            module: "ESNext",
            moduleResolution: "Bundler",
            noEmit: true,
            skipLibCheck: true,
            strict: true,
            target: "ES2022",
          },
          include: [
            "generated-contracts.d.ts",
            "apps/api-server/src/**/*.ts",
            "apps/console-web/pages/**/*.ts",
          ],
        },
        null,
        2,
      ),
    );

    await expectGeneratedFixtureToTypecheck(tsconfigPath);
  });
});

async function createWorkspace(): Promise<string> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-croco-e2e-"));
  tmpRoots.push(tmpRoot);

  const cwd = path.join(tmpRoot, "test-app");
  await fs.mkdir(path.join(cwd, "apps", "api-server", "src"), {
    recursive: true,
  });
  await fs.mkdir(path.join(cwd, "apps", "console-web", "pages"), {
    recursive: true,
  });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "test-app", private: true }, null, 2),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    packageManifest([
      "@croco/billing-core",
      "@croco/entitlements-core",
      "@croco/events-core",
      "@croco/framework-context",
      "@croco/metering-core",
      "@croco/problems-core",
      "@croco/protocols-rest",
      "@croco/repository-core",
      "@croco/tenant-core",
      "@croco/transports-http",
      "typedi",
      "zod",
    ]),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "console-web", "package.json"),
    packageManifest(["@croco/frontend-vite", "@croco/meta-vite", "react"]),
  );
  await fs.writeFile(
    path.join(cwd, "apps", "console-web", "pages", "index.ts"),
    "export const index = true;\n",
  );
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "src", "index.ts"),
    `import { createApp } from '@croco/transports-http';

const app = createApp();
app.addControllers([]);
app.listen({ port: 3000 });
`,
  );

  return cwd;
}

async function readApiEntry(cwd: string): Promise<string> {
  return fs.readFile(path.join(cwd, "apps", "api-server", "src", "index.ts"), "utf-8");
}

async function expectGeneratedFixtureToTypecheck(tsconfigPath: string): Promise<void> {
  try {
    await execFileAsync("pnpm", ["exec", "tsc", "-p", tsconfigPath, "--noEmit"], {
      cwd: REPO_ROOT,
    });
  } catch (error) {
    const output = getExecOutput(error);
    throw new Error(`Generated fixture failed to typecheck.\n${output}`);
  }
}

function getExecOutput(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const { message, stdout, stderr } = error as {
      message?: string;
      stdout?: string;
      stderr?: string;
    };
    return [message, stdout, stderr].filter(Boolean).join("\n");
  }

  return String(error);
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

function generatedContractDeclarations(): string {
  return `declare namespace JSX {
  type Element = unknown;

  interface IntrinsicElements {
    [elementName: string]: { readonly [key: string]: unknown };
  }
}

declare module 'react' {
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useState<T>(initial: T): [T, (value: T) => void];
}

declare module '@croco/protocols-rest' {
  export function Controller(path: string): ClassDecorator;
  export function Ctx(): ParameterDecorator;
  export function Delete(path: string): MethodDecorator;
  export function Get(path: string): MethodDecorator;
  export function Post(path: string): MethodDecorator;
  export function Put(path: string): MethodDecorator;
  export function ResponseSchema(schema: unknown): MethodDecorator;
}

declare module '@croco/transports-http' {
  export type CrocoHttpContext = {
    header(name: string): string | undefined;
    query(name: string): string | undefined;
  };

  export function createApp(): {
    addControllers(controllers: readonly Function[]): void;
    listen(options: { readonly port: number }): void;
  };
}

declare module '@croco/repository-core' {
  export interface Repository<TEntity, TId> {
    findById(id: TId): Promise<TEntity | null>;
    findByIds(ids: readonly TId[]): Promise<ReadonlyArray<TEntity>>;
    save(entity: TEntity): Promise<TEntity>;
    deleteById(id: TId): Promise<void>;
  }
}

declare module '@croco/events-core' {
  export abstract class DomainEvent<TPayload = unknown> {}

  export interface EventHandler<TEvent> {
    handle(event: TEvent): void | Promise<void>;
  }

  export function RegisterEventHandler(event: Function): ClassDecorator;
}

declare module '@croco/framework-context' {
  export function Component(options?: {
    readonly scope?: 'singleton' | 'request' | 'transient';
  }): ClassDecorator;
}

declare module '@croco/meta-vite' {
  export type RenderRouteComponentProps = {
    readonly request: Request;
    readonly context?: unknown;
  };

  export type PageRouteDefinition = {
    readonly path: string;
    readonly component: (props: RenderRouteComponentProps) => JSX.Element;
    readonly mode?: 'ssr' | 'ssg' | 'isr' | 'rsc';
  };

  export function defineRoute(route: PageRouteDefinition): PageRouteDefinition;
}

declare module 'typedi' {
  export function Service(): ClassDecorator;
}

declare module 'zod' {
  export type ZodTypeAny = {
    nullable(): ZodTypeAny;
  };

  export const z: {
    array(item: ZodTypeAny): ZodTypeAny;
    boolean(): ZodTypeAny;
    enum(values: readonly string[]): ZodTypeAny;
    number(): ZodTypeAny;
    object(shape: Record<string, ZodTypeAny>): ZodTypeAny;
    string(): ZodTypeAny;
  };
}

declare module '@croco/problems-core' {
  export type ProblemDetails = {
    readonly type: string;
    readonly title: string;
    readonly status: number;
    readonly detail?: string;
    readonly instance?: string;
    readonly code: string;
  } & Record<string, unknown>;

  export type ProblemOptions = {
    readonly type?: string;
    readonly instance?: string;
    readonly extensions?: Record<string, unknown>;
    readonly cause?: Error;
  };

  export abstract class Problem extends Error {
    constructor(code?: string, category?: ProblemCategory, detail?: string, options?: ProblemOptions);
    toJSON(): ProblemDetails;
  }

  export enum ProblemCategory {
    ValidationError = 'ValidationError',
    NotFound = 'NotFound',
    InternalServerError = 'InternalServerError',
  }
}

declare module '@croco/billing-core' {
  export type Subscription = {
    readonly planId: string;
    readonly status: 'active' | 'past_due' | 'canceled' | 'revoked' | 'trialing';
    readonly currentPeriodEnd: Date;
  };

  export class BillingService {
    getSubscription(tenantId: string): Promise<Subscription | null>;
  }
}

declare module '@croco/entitlements-core' {
  export type OveragePolicy = 'BLOCK' | 'WARN' | 'ALLOW_WITH_OVERAGE';

  export type EntitlementCheckResult = {
    readonly granted: boolean;
    readonly featureKey: string;
    readonly type: 'boolean' | 'metered' | 'static';
    readonly usage?: number;
    readonly quota?: number;
    readonly remaining?: number;
    readonly value?: number;
    readonly planId?: string;
    readonly reason?: string;
    readonly overagePolicy?: OveragePolicy;
  };

  export class EntitlementManager {
    check(tenantId: string, featureKey: string): Promise<EntitlementCheckResult>;
  }
}

declare module '@croco/metering-core' {
  export type UsageQueryOptions = {
    readonly tenantId: string;
    readonly meterId: string;
    readonly period: 'hour' | 'day' | 'billing_cycle';
  };

  export type MeterDefinition = {
    readonly id: string;
    readonly tenantId: string;
    readonly meterId: string;
    readonly type: 'COUNT' | 'UNIQUE_COUNT' | 'CUSTOM_EVENT';
    readonly quota?: number;
    readonly allowOverQuota?: boolean;
    readonly metadata?: Record<string, unknown>;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };

  export class MeterRegistry {
    getByTenant(tenantId: string): Promise<MeterDefinition[]>;
  }

  export class MeteringService {
    getUsage(options: UsageQueryOptions): Promise<number>;
  }
}

declare module '@croco/tenant-core' {
  export type Tenant = {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly status: string;
    readonly settings: {
      readonly features?: readonly string[];
    };
  };

  export interface TenantStore {
    findById(id: string): Promise<Tenant | null>;
  }
}
`;
}
