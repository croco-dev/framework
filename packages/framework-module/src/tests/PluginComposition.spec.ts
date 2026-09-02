import { Inject, Token } from "typedi";
import { describe, expect, it, vi } from "vitest";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  defineCrocoModule,
  defineCrocoPlugin,
  InvalidModuleDefinitionProblem,
  ModuleContributionIdentityProblem,
  type ModuleContext,
  ModuleProviderOwnershipProblem,
} from "../index";

describe("plugin composition", () => {
  it("composes configured plugins through the application-owned module lifecycle", async () => {
    const lifecycle: string[] = [];
    const providerToken = new Token<string>("configured-provider");
    const plugin = defineCrocoPlugin({
      metadata: {
        name: "configured-plugin",
        packageName: "@croco/configured-plugin",
        maturity: "beta",
        providedContracts: ["example/ConfiguredProvider"],
        capabilities: [{ id: "example.configured-provider", kind: "single" }],
        runtimeCompatibility: ["node", "lambda"],
        configuration: [{ key: "PLUGIN_SECRET", required: true, sensitive: true }],
        verification: [
          {
            command: "pnpm --filter @croco/configured-plugin test",
            reference: "packages/configured-plugin/src/tests/Plugin.spec.ts",
          },
        ],
        examples: ["packages/configured-plugin/README.md"],
      },
      modules: [
        defineCrocoModule({
          name: "configured-plugin",
          providers: [{ provide: providerToken, useValue: "configured" }],
          exports: [providerToken],
          setup: () => {
            lifecycle.push("setup");
          },
          shutdown: () => {
            lifecycle.push("shutdown");
          },
        }),
      ],
    });
    const application = defineCrocoApplication({ imports: [plugin] });
    const runtime = createApplicationRuntime(application);

    expect(runtime.createGraphManifest()).toMatchObject({
      plugins: [
        {
          name: "configured-plugin",
          packageName: "@croco/configured-plugin",
          capabilities: [{ id: "example.configured-provider", kind: "single" }],
          configuration: [{ key: "PLUGIN_SECRET", required: true, sensitive: true }],
        },
      ],
    });

    await runtime.initialize();

    expect(runtime.get(providerToken)).toBe("configured");

    await runtime.dispose();
    expect(lifecycle).toEqual(["setup", "shutdown"]);
  });

  it("rejects duplicate single capability claims even when provider tokens differ", () => {
    const createPlugin = (name: string, token: Token<string>) =>
      defineCrocoPlugin({
        metadata: {
          name,
          packageName: `@croco/${name}`,
          maturity: "beta",
          providedContracts: [],
          capabilities: [{ id: "auth.provider", kind: "single" }],
          runtimeCompatibility: ["node"],
          configuration: [],
          verification: [],
          examples: [],
        },
        modules: [
          defineCrocoModule({
            name,
            providers: [{ provide: token, useValue: name }],
            exports: [token],
          }),
        ],
      });

    expect(() =>
      createApplicationRuntime(
        defineCrocoApplication({
          imports: [
            createPlugin("first-auth", new Token<string>("first-auth")),
            createPlugin("second-auth", new Token<string>("second-auth")),
          ],
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "framework-module/invalid-module-definition",
        extensions: {
          capabilityId: "auth.provider",
          owners: ["first-auth", "second-auth"],
        },
      }),
    );
  });

  it("requires an explicit application replacement for duplicate single-owner providers", async () => {
    const providerToken = new Token<string>("single-owner");
    const first = defineCrocoModule({
      name: "first-plugin",
      providers: [{ provide: providerToken, useValue: "first" }],
      exports: [providerToken],
    });
    const second = defineCrocoModule({
      name: "second-plugin",
      providers: [{ provide: providerToken, useValue: "second" }],
      exports: [providerToken],
    });
    const conflictingRuntime = createApplicationRuntime(
      defineCrocoApplication({ imports: [first, second] }),
    );

    await expect(conflictingRuntime.initialize()).rejects.toBeInstanceOf(
      ModuleProviderOwnershipProblem,
    );
    await conflictingRuntime.dispose();

    const replacedRuntime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [first, second],
        providerReplacements: [
          {
            provider: { provide: providerToken, useValue: "application" },
            replaces: ["first-plugin", "second-plugin"],
          },
        ],
      }),
    );
    await replacedRuntime.initialize();

    expect(replacedRuntime.get(providerToken)).toBe("application");
    expect(replacedRuntime.createGraphManifest().providerReplacements).toEqual([
      {
        token: "single-owner",
        replaces: ["first-plugin", "second-plugin"],
      },
    ]);

    await replacedRuntime.dispose();

    const invalidReplacementRuntime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [first],
        providerReplacements: [
          {
            provider: { provide: providerToken, useValue: "invalid" },
            replaces: ["second-plugin"],
          },
        ],
      }),
    );

    await expect(invalidReplacementRuntime.initialize()).rejects.toBeInstanceOf(
      InvalidModuleDefinitionProblem,
    );
    await invalidReplacementRuntime.dispose();

    const duplicateOwnerRuntime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [first],
        providerReplacements: [
          {
            provider: { provide: providerToken, useValue: "invalid" },
            replaces: ["first-plugin", "first-plugin"],
          },
        ],
      }),
    );

    await expect(duplicateOwnerRuntime.initialize()).rejects.toBeInstanceOf(
      InvalidModuleDefinitionProblem,
    );
    await duplicateOwnerRuntime.dispose();
  });

  it("registers factory and class replacements in an application-owned context", async () => {
    const dependencyToken = new Token<string>("replacement-dependency");
    const factoryToken = new Token<string>("factory-replacement");
    const classToken = new Token<ReplacementService>("class-replacement");
    const observedDuringSetup: string[] = [];

    class ReplacementService {
      constructor(@Inject(dependencyToken) readonly dependency: string) {}
    }
    Reflect.defineMetadata("design:paramtypes", [String], ReplacementService);

    const dependency = defineCrocoModule({
      name: "replacement-dependency",
      providers: [{ provide: dependencyToken, useValue: "configured" }],
      exports: [dependencyToken],
    });
    const ownerWithImport = defineCrocoModule({
      name: "owner-with-import",
      imports: [dependency],
      providers: [
        { provide: factoryToken, useValue: "first-factory" },
        { provide: classToken, useValue: new ReplacementService("first-class") },
      ],
      exports: [factoryToken, classToken],
      setup: (ctx) => {
        observedDuringSetup.push(`${ctx.get(factoryToken)}:${ctx.get(classToken).dependency}`);
      },
    });
    const ownerWithoutImport = defineCrocoModule({
      name: "owner-without-import",
      providers: [
        { provide: factoryToken, useValue: "second-factory" },
        { provide: classToken, useValue: new ReplacementService("second-class") },
      ],
      exports: [factoryToken, classToken],
      setup: (ctx) => {
        observedDuringSetup.push(`${ctx.get(factoryToken)}:${ctx.get(classToken).dependency}`);
      },
    });

    for (const imports of [
      [ownerWithImport, ownerWithoutImport],
      [ownerWithoutImport, ownerWithImport],
    ]) {
      const runtime = createApplicationRuntime(
        defineCrocoApplication({
          imports,
          providerReplacements: [
            {
              provider: {
                provide: factoryToken,
                useFactory: (ctx) => `${ctx.get(dependencyToken)}-factory`,
              },
              replaces: ["owner-with-import", "owner-without-import"],
            },
            {
              provider: { provide: classToken, useClass: ReplacementService },
              replaces: ["owner-with-import", "owner-without-import"],
            },
          ],
        }),
      );

      await runtime.initialize();

      expect(runtime.get(factoryToken)).toBe("configured-factory");
      expect(runtime.get(classToken).dependency).toBe("configured");
      expect(observedDuringSetup.splice(0)).toEqual([
        "configured-factory:configured",
        "configured-factory:configured",
      ]);
      await runtime.dispose();
    }
  });

  it("rejects owner setup writes to application-replaced providers", async () => {
    const replacedToken = new Token<string>("setup-overwrite-replacement");
    const owner = defineCrocoModule({
      name: "setup-overwrite-owner",
      providers: [{ provide: replacedToken, useValue: "owner" }],
      exports: [replacedToken],
      setup: (ctx) => {
        ctx.set(replacedToken, "overwritten");
      },
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [owner],
        providerReplacements: [
          {
            provider: { provide: replacedToken, useValue: "application" },
            replaces: ["setup-overwrite-owner"],
          },
        ],
      }),
    );

    await expect(runtime.initialize()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      cause: expect.objectContaining({
        code: "framework-module/provider-write-not-owned",
        extensions: {
          declaredOwner: "<application>",
          moduleName: "setup-overwrite-owner",
          token: "setup-overwrite-replacement",
        },
      }),
      extensions: {
        moduleName: "setup-overwrite-owner",
        phase: "setup",
      },
    });
    await runtime.dispose();
  });

  it("preserves dependency setup ordering when an application has replacements", async () => {
    const setupBoundToken = new Token<string>("setup-bound");
    const consumerToken = new Token<string>("setup-consumer");
    const replacedToken = new Token<string>("unrelated-replacement");
    const observedReplacements: string[] = [];
    const dependency = defineCrocoModule({
      name: "setup-dependency",
      providers: [setupBoundToken],
      exports: [setupBoundToken],
      setup: (ctx) => {
        ctx.set(setupBoundToken, "ready");
      },
    });
    const consumer = defineCrocoModule({
      name: "setup-consumer",
      imports: [dependency],
      providers: [
        {
          provide: consumerToken,
          useFactory: (ctx) => `${ctx.get(setupBoundToken)}-consumer`,
        },
      ],
      exports: [consumerToken],
    });
    const firstOwner = defineCrocoModule({
      name: "unrelated-owner-a",
      providers: [{ provide: replacedToken, useValue: "a" }],
      setup: (ctx) => {
        observedReplacements.push(ctx.get(replacedToken));
      },
    });
    const secondOwner = defineCrocoModule({
      name: "unrelated-owner-b",
      providers: [{ provide: replacedToken, useValue: "b" }],
      setup: (ctx) => {
        observedReplacements.push(ctx.get(replacedToken));
      },
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [firstOwner, secondOwner, consumer],
        providerReplacements: [
          {
            provider: { provide: replacedToken, useValue: "application" },
            replaces: ["unrelated-owner-a", "unrelated-owner-b"],
          },
        ],
      }),
    );

    await runtime.initialize();

    expect(runtime.get(consumerToken)).toBe("ready-consumer");
    expect(runtime.get(replacedToken)).toBe("application");
    expect(observedReplacements).toEqual(["application", "application"]);
    await runtime.dispose();
  });

  it("orders multi-contributions deterministically and rejects duplicate identities", async () => {
    const first = defineCrocoModule({
      name: "first-contributor",
      contributions: [
        { kind: "http.middleware", id: "z-last", order: 20, value: "last" },
        { kind: "http.middleware", id: "a-second", order: 10, value: "second" },
      ],
    });
    const second = defineCrocoModule({
      name: "second-contributor",
      contributions: [
        { kind: "http.middleware", id: "b-third", order: 10, value: "third" },
        { kind: "diagnostics.provider", id: "health", value: "health" },
      ],
    });
    const runtime = createApplicationRuntime(defineCrocoApplication({ imports: [first, second] }));
    await runtime.initialize();

    expect(runtime.getContributions<string>("http.middleware")).toEqual([
      {
        kind: "http.middleware",
        id: "a-second",
        order: 10,
        moduleName: "first-contributor",
        value: "second",
      },
      {
        kind: "http.middleware",
        id: "b-third",
        order: 10,
        moduleName: "second-contributor",
        value: "third",
      },
      {
        kind: "http.middleware",
        id: "z-last",
        order: 20,
        moduleName: "first-contributor",
        value: "last",
      },
    ]);

    await runtime.dispose();

    const duplicateRuntime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [
          defineCrocoModule({
            name: "duplicate-a",
            contributions: [{ kind: "http.controller", id: "orders", value: "a" }],
          }),
          defineCrocoModule({
            name: "duplicate-b",
            contributions: [{ kind: "http.controller", id: "orders", value: "b" }],
          }),
        ],
      }),
    );

    await expect(duplicateRuntime.initialize()).rejects.toBeInstanceOf(
      ModuleContributionIdentityProblem,
    );
    await duplicateRuntime.dispose();

    const duplicateWithinModuleRuntime = createApplicationRuntime(
      defineCrocoApplication({
        imports: [
          defineCrocoModule({
            name: "duplicate-within-module",
            contributions: [
              { kind: "task.handler", id: "orders", value: "first" },
              { kind: "task.handler", id: "orders", value: "second" },
            ],
          }),
        ],
      }),
    );

    await expect(duplicateWithinModuleRuntime.initialize()).rejects.toBeInstanceOf(
      ModuleContributionIdentityProblem,
    );
    await duplicateWithinModuleRuntime.dispose();
  });

  it("exposes contributions to module factories without a parallel lifecycle registry", async () => {
    const aggregateToken = new Token<readonly string[]>("aggregate");
    const aggregateFactory = vi.fn((ctx: ModuleContext) =>
      ctx.getContributions<string>("event.handler").map((contribution) => contribution.value),
    );
    const application = defineCrocoApplication({
      imports: [
        defineCrocoModule({
          name: "event-handlers",
          contributions: [
            { kind: "event.handler", id: "second", order: 20, value: "second" },
            { kind: "event.handler", id: "first", order: 10, value: "first" },
          ],
        }),
        defineCrocoModule({
          name: "event-host",
          providers: [{ provide: aggregateToken, useFactory: aggregateFactory }],
          exports: [aggregateToken],
        }),
      ],
    });
    const runtime = createApplicationRuntime(application);

    await runtime.initialize();

    expect(runtime.get(aggregateToken)).toEqual(["first", "second"]);
    expect(aggregateFactory).toHaveBeenCalledTimes(1);

    await runtime.dispose();
  });
});
