import { describe, expectTypeOf, it } from "vitest";
import type { TenantModelName } from "@croco/tenant-core/tenant-model";
import type { ApplicationIntentGoal } from "@croco/framework-context";
import type { SaasProviderProfileName } from "../saas-provider-profiles.js";
import type {
  AppGoal,
  GeneratorOptions,
  NormalizedGeneratorOptions,
  TenantModelName as GeneratorTenantModelName,
} from "../types.js";

describe("GeneratorOptions", () => {
  it("keeps self-contained public discriminators aligned with framework contracts", () => {
    expectTypeOf<AppGoal>().toEqualTypeOf<ApplicationIntentGoal>();
    expectTypeOf<GeneratorTenantModelName>().toEqualTypeOf<TenantModelName>();
  });

  it("accepts only fields owned by each resolved preset branch", () => {
    const apiOptions: GeneratorOptions = {
      projectName: "api",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      api: "trpc",
      apiHosting: "standalone",
      backendDeploy: "lambda",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    const saasOptions: GeneratorOptions = {
      projectName: "saas",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      tenantModel: "org",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };

    expectTypeOf(apiOptions).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(saasOptions).toMatchTypeOf<GeneratorOptions>();
  });

  it("rejects contradictory resolved preset combinations", () => {
    const apiWithSaasProvider: GeneratorOptions = {
      projectName: "api",
      scope: "@test",
      preset: "ddd-api",
      // @ts-expect-error SaaS provider profiles are owned only by SaaS preset branches.
      saasProviderProfile: "saas-lambda",
      webApps: [],
      api: "trpc",
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    const saasWithApi: GeneratorOptions = {
      projectName: "saas",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      tenantModel: "org",
      webApps: [],
      // @ts-expect-error SaaS preset branches do not expose configurable API fields.
      api: "trpc",
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    // @ts-expect-error DDD API generation requires a resolved API contract.
    const apiWithoutProtocol: GeneratorOptions = {
      projectName: "api",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    // @ts-expect-error Goal and preset discriminators must describe the same resolved branch.
    const mismatchedGoal: GeneratorOptions = {
      projectName: "saas",
      scope: "@test",
      goal: "saas-api",
      preset: "production-app",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    // @ts-expect-error The saas-api goal resolves to the Node/Postgres provider profile.
    const saasGoalWithMismatchedProvider: GeneratorOptions = {
      projectName: "saas",
      scope: "@test",
      goal: "saas-api",
      preset: "saas",
      saasProviderProfile: "saas-lambda",
      tenantModel: "org",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };
    // @ts-expect-error The saas-api goal resolves to organization tenancy.
    const saasGoalWithMismatchedTenant: GeneratorOptions = {
      projectName: "saas",
      scope: "@test",
      goal: "saas-api",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      tenantModel: "workspace",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };

    expectTypeOf(apiWithSaasProvider).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(saasWithApi).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(apiWithoutProtocol).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(mismatchedGoal).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(saasGoalWithMismatchedProvider).toMatchTypeOf<GeneratorOptions>();
    expectTypeOf(saasGoalWithMismatchedTenant).toMatchTypeOf<GeneratorOptions>();
  });

  it("keeps malformed normalized input available to runtime validation", () => {
    const normalizedInput: NormalizedGeneratorOptions = {
      preset: "ddd-api",
      saasProviderProfile: "saas-lambda",
    };

    expectTypeOf(normalizedInput).toMatchTypeOf<NormalizedGeneratorOptions>();
  });

  it("exposes required fields after preset narrowing", () => {
    function inspect(options: GeneratorOptions): void {
      if (options.preset === "ddd-api") {
        expectTypeOf(options.api).toEqualTypeOf<"graphql" | "trpc">();
      }

      if (options.preset === "saas" || options.preset === "ai-saas") {
        expectTypeOf(options.saasProviderProfile).toEqualTypeOf<SaasProviderProfileName>();
        expectTypeOf(options.tenantModel).toEqualTypeOf<TenantModelName>();
      }

      if (options.preset === "ddd-vike-fullstack") {
        expectTypeOf(options.frontendDeploy).toEqualTypeOf<"cloudflare-meta-vite">();
      }
    }

    expectTypeOf(inspect).toBeFunction();
  });
});
