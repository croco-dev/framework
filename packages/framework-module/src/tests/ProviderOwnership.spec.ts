import { Container as FrameworkContainer } from "@croco/framework-context";
import { Container as TypeDIContainer, Token } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createModuleGraphManifest,
  CrocoModule,
  defineCrocoModule,
  ModuleProviderOwnershipProblem,
  ModuleProviderWriteProblem,
} from "../index";
import type { ModuleOptions, ModuleProvider, ModuleToken } from "../index";

describe("module provider ownership", () => {
  beforeEach(() => {
    CrocoModule.reset();
    FrameworkContainer.reset();
  });

  it.each([
    ["value/value", { useValue: "left" }, { useValue: "right" }],
    ["value/class", { useValue: "left" }, { useClass: class Right {} }],
    ["value/factory", { useValue: "left" }, { useFactory: (): string => "right" }],
    ["class/value", { useClass: class Left {} }, { useValue: "right" }],
    ["class/class", { useClass: class Left {} }, { useClass: class Right {} }],
    ["class/factory", { useClass: class Left {} }, { useFactory: (): string => "right" }],
    ["factory/value", { useFactory: (): string => "left" }, { useValue: "right" }],
    ["factory/class", { useFactory: (): string => "left" }, { useClass: class Right {} }],
    [
      "factory/factory",
      { useFactory: (): string => "left" },
      { useFactory: (): string => "right" },
    ],
  ])("rejects %s definitions with the same token", async (_name, left, right) => {
    const token = new Token<unknown>("shared");
    CrocoModule.use({ name: "zeta", providers: [{ provide: token, ...left } as ModuleProvider] });
    CrocoModule.use({ name: "alpha", providers: [{ provide: token, ...right } as ModuleProvider] });

    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      code: "framework-module/provider-ownership-conflict",
      detail: "Provider 'shared' has multiple module owners: 'alpha', 'zeta'.",
      extensions: { token: "shared", owners: ["alpha", "zeta"] },
    });
  });

  it.each([
    ["string", (): ModuleToken<unknown> => "shared-string"],
    ["symbol", (): ModuleToken<unknown> => Symbol("shared-symbol")],
    ["class", (): ModuleToken<unknown> => class SharedService {}],
    ["TypeDI Token", (): ModuleToken<unknown> => new Token("shared-token")],
  ])(
    "rejects ambiguous %s ownership in either root order before mutation",
    async (_name, createToken) => {
      for (const reversed of [false, true]) {
        CrocoModule.reset();
        FrameworkContainer.reset();
        const token = createToken();
        const modules: ModuleOptions[] = [
          { name: "zeta", providers: [{ provide: token, useValue: "zeta" }] },
          { name: "alpha", providers: [{ provide: token, useValue: "alpha" }] },
        ];

        for (const module of reversed ? [...modules].reverse() : modules) {
          CrocoModule.use(module);
        }

        await expect(CrocoModule.initialize()).rejects.toMatchObject({
          code: "framework-module/provider-ownership-conflict",
          extensions: { owners: ["alpha", "zeta"] },
        });
        expect(FrameworkContainer.has(token)).toBe(false);
      }
    },
  );

  it("reports every owner before factories or setup run", async () => {
    const token = new Token<string>("shared");
    const factory = vi.fn(() => "value");
    const setup = vi.fn();
    const roots: ModuleOptions[] = [
      { name: "gamma", providers: [{ provide: token, useFactory: factory }], setup },
      { name: "alpha", providers: [{ provide: token, useValue: "alpha" }], setup },
      { name: "beta", providers: [{ provide: token, useValue: "beta" }], setup },
    ];

    for (const module of [...roots].reverse()) {
      CrocoModule.use(module);
    }

    await expect(CrocoModule.initialize()).rejects.toBeInstanceOf(ModuleProviderOwnershipProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      extensions: { owners: ["alpha", "beta", "gamma"] },
    });
    expect(factory).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
    expect(TypeDIContainer.has(token)).toBe(false);
  });

  it("produces the same ownership diagnostic for reversed roots", () => {
    const token = new Token<string>("shared");
    const alpha = defineCrocoModule({
      name: "alpha",
      providers: [{ provide: token, useValue: "alpha" }],
    });
    const zeta = defineCrocoModule({
      name: "zeta",
      providers: [{ provide: token, useValue: "zeta" }],
    });

    const forward = createModuleGraphManifest([zeta, alpha]);
    const reverse = createModuleGraphManifest([alpha, zeta]);

    expect(forward.diagnostics).toEqual(reverse.diagnostics);
    expect(forward.diagnostics).toContainEqual({
      code: "framework-module/provider-ownership-conflict",
      severity: "error",
      moduleName: "alpha",
      token: "shared",
      message: "Provider 'shared' has multiple module owners: 'alpha', 'zeta'.",
      path: ["alpha", "zeta"],
    });
  });

  it("keys ownership by identity rather than diagnostic labels", async () => {
    const firstToken = new Token<string>("same-label");
    const secondToken = new Token<string>("same-label");
    const firstSymbol = Symbol("same-label");
    const secondSymbol = Symbol("same-label");

    CrocoModule.use({
      name: "first",
      providers: [
        { provide: firstToken, useValue: "first-token" },
        { provide: firstSymbol, useValue: "first-symbol" },
      ],
    });
    CrocoModule.use({
      name: "second",
      providers: [
        { provide: secondToken, useValue: "second-token" },
        { provide: secondSymbol, useValue: "second-symbol" },
      ],
    });

    await CrocoModule.initialize();

    expect(FrameworkContainer.get(firstToken)).toBe("first-token");
    expect(FrameworkContainer.get(secondToken)).toBe("second-token");
    expect(FrameworkContainer.get(firstSymbol)).toBe("first-symbol");
    expect(FrameworkContainer.get(secondSymbol)).toBe("second-symbol");
  });

  it("does not treat repeated declarations in one module as multiple owners", async () => {
    const token = new Token<string>("config");
    CrocoModule.use({
      name: "config",
      providers: [
        { provide: token, useValue: "first" },
        { provide: token, useValue: "second" },
      ],
    });

    await expect(CrocoModule.initialize()).resolves.toBeDefined();
  });

  it("keeps imported exported providers read-only", async () => {
    const token = new Token<string>("config");
    const owner = defineCrocoModule({
      name: "owner",
      providers: [{ provide: token, useValue: "owned" }],
      exports: [token],
    });
    CrocoModule.use({
      name: "consumer",
      imports: [owner],
      setup: (ctx) => ctx.set(token, "shadow"),
    });

    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      cause: expect.objectContaining({
        code: "framework-module/provider-write-not-owned",
        detail:
          "Module 'consumer' cannot write provider 'config' owned by module 'owner'. Imported providers are read-only; declare a distinct token instead.",
        extensions: { moduleName: "consumer", token: "config", declaredOwner: "owner" },
      }),
    });
    expect(TypeDIContainer.get(token)).toBe("owned");
  });

  it("allows local token-only writes and rejects undeclared writes before mutation", async () => {
    const localToken = new Token<string>("local");
    const undeclaredToken = new Token<string>("undeclared");
    CrocoModule.use({
      name: "owner",
      providers: [localToken],
      setup: (ctx) => {
        ctx.set(localToken, "local-value");
        ctx.set(undeclaredToken, "forbidden");
      },
    });

    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.objectContaining({
        code: "framework-module/provider-write-not-owned",
        detail:
          "Module 'owner' cannot write undeclared provider 'undeclared'. Add the token to the module's providers metadata before calling ModuleContext.set().",
        extensions: { moduleName: "owner", token: "undeclared" },
      }),
    });
    expect(TypeDIContainer.has(undeclaredToken)).toBe(false);
  });

  it("rejects root-context writes directly before mutation", async () => {
    const token = new Token<string>("root-write");
    CrocoModule.use({ name: "app", setup: () => undefined });
    const context = await CrocoModule.initialize();

    expect(() => context.set(token, "forbidden")).toThrow(ModuleProviderWriteProblem);
    expect(() => context.set(token, "forbidden")).toThrow(
      "Root module context cannot write provider 'root-write'. Provider writes require ownership declared by a named module.",
    );
    expect(TypeDIContainer.has(token)).toBe(false);
  });

  it("shares symbol-backed registrations with framework-context and resets coherently", async () => {
    const token = Symbol("shared-symbol");
    CrocoModule.use({ name: "symbols", providers: [{ provide: token, useValue: "value" }] });

    await CrocoModule.initialize();

    const identifier = FrameworkContainer.toTypeDIServiceIdentifier(token);
    expect(TypeDIContainer.get(identifier as Token<string>)).toBe("value");
    expect(FrameworkContainer.get(token)).toBe("value");

    CrocoModule.reset();
    FrameworkContainer.reset();
    CrocoModule.use({ name: "symbols", providers: [{ provide: token, useValue: "next" }] });
    await CrocoModule.initialize();

    expect(FrameworkContainer.get(token)).toBe("next");
  });

  it("rejects redeclaring an imported provider as a second owner", async () => {
    const token = Symbol("shared");
    const owner = defineCrocoModule({
      name: "owner",
      providers: [{ provide: token, useValue: "owned" }],
      exports: [token],
    });
    CrocoModule.use({
      name: "consumer",
      imports: [owner],
      providers: [{ provide: token, useValue: "shadow" }],
    });

    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      code: "framework-module/provider-ownership-conflict",
      extensions: { token: "shared", owners: ["consumer", "owner"] },
    });
  });

  it("ignores class bindings added to source metadata after registration snapshot", async () => {
    class Attacker {}

    const sharedToken = new Token<unknown>("shared");
    const triggerToken = new Token<string>("trigger");
    const attackerProviders: ModuleProvider[] = [
      {
        provide: triggerToken,
        useFactory: () => {
          attackerProviders.push({ provide: sharedToken, useClass: Attacker });
          return "triggered";
        },
      },
    ];

    CrocoModule.use({
      name: "owner",
      providers: [{ provide: sharedToken, useValue: "safe" }],
    });
    CrocoModule.use({ name: "attacker", providers: attackerProviders });

    await expect(CrocoModule.initialize()).resolves.toBeDefined();
    expect(TypeDIContainer.get(sharedToken)).toBe("safe");
    expect(FrameworkContainer.has(Attacker)).toBe(false);
  });

  it("uses one captured token identity for class-binding validation and mutation", async () => {
    class Attacker {}

    const victimToken = new Token<unknown>("victim");
    const attackerToken = new Token<unknown>("attacker-owned");
    let tokenReads = 0;
    const shiftingProvider = {
      get provide(): ModuleToken<unknown> {
        tokenReads += 1;
        return tokenReads === 1 ? attackerToken : victimToken;
      },
      useClass: Attacker,
    } as ModuleProvider;

    CrocoModule.use({
      name: "owner",
      providers: [{ provide: victimToken, useValue: "safe" }],
    });
    CrocoModule.use({ name: "attacker", providers: [shiftingProvider] });

    await expect(CrocoModule.initialize()).resolves.toBeDefined();
    expect(tokenReads).toBe(1);
    expect(TypeDIContainer.get(victimToken)).toBe("safe");
    expect(TypeDIContainer.get(attackerToken)).toBeInstanceOf(Attacker);
  });

  it("reads module provider metadata once when registration snapshots the graph", async () => {
    class Attacker {}

    const victimToken = new Token<unknown>("victim");
    const innocentToken = new Token<string>("innocent");
    let providerReads = 0;
    const attackerModule: ModuleOptions = {
      name: "attacker",
      get providers(): readonly ModuleProvider[] {
        providerReads += 1;
        return providerReads === 1
          ? [{ provide: innocentToken, useValue: "innocent" }]
          : [{ provide: victimToken, useClass: Attacker }];
      },
    };

    CrocoModule.use({
      name: "owner",
      providers: [{ provide: victimToken, useValue: "safe" }],
    });
    CrocoModule.use(attackerModule);

    await CrocoModule.initialize();

    expect(providerReads).toBe(1);
    expect(TypeDIContainer.get(victimToken)).toBe("safe");
    expect(TypeDIContainer.get(innocentToken)).toBe("innocent");
  });
});
