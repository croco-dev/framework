import "reflect-metadata";
import { Inject, Service as Component, Container, Token } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CrocoModule,
  defineCrocoModule,
  detectCircularDependency,
  ModuleCircularDependencyProblem,
  ModuleContext,
  ModuleDiagnosticsProvider,
  ModuleLifecycleProblem,
  ModuleProviderVisibilityProblem,
} from "../index";
import type { ModuleOptions } from "../types";

@Component()
class GreeterService {
  greet(): string {
    return "hello";
  }
}

describe("CrocoModule", () => {
  beforeEach(() => {
    CrocoModule.reset();
    Container.reset();
  });

  it("registers a module with use", async () => {
    const calls: string[] = [];

    CrocoModule.use({
      name: "app",
      setup: () => {
        calls.push("setup");
      },
    });

    await CrocoModule.initialize();

    expect(calls).toEqual(["setup"]);
  });

  it("runs setup in dependency order", async () => {
    const calls: string[] = [];
    const database: ModuleOptions = {
      name: "database",
      setup: () => {
        calls.push("database");
      },
    };
    const users: ModuleOptions = {
      name: "users",
      imports: [database],
      setup: () => {
        calls.push("users");
      },
    };
    const api: ModuleOptions = {
      name: "api",
      imports: [users],
      setup: () => {
        calls.push("api");
      },
    };

    CrocoModule.use(api);
    CrocoModule.use(users);
    CrocoModule.use(database);

    await CrocoModule.initialize();

    expect(calls).toEqual(["database", "users", "api"]);
  });

  it("retrieves services from the container through ModuleContext.get", async () => {
    CrocoModule.use({
      name: "app",
      providers: [GreeterService],
      setup: (ctx) => {
        expect(ctx.get(GreeterService).greet()).toBe("hello");
      },
    });

    await CrocoModule.initialize();
  });

  it("registers services in the container through ModuleContext.set", async () => {
    const token = new Token<{ readonly name: string }>("config");

    CrocoModule.use({
      name: "config",
      exports: [token],
      setup: (ctx) => ctx.set(token, { name: "croco" }),
      start: () => {
        expect(Container.get(token)).toEqual({ name: "croco" });
      },
    });

    await CrocoModule.initialize();
  });

  it("runs setup before start", async () => {
    const calls: string[] = [];

    CrocoModule.use({
      name: "app",
      setup: () => {
        calls.push("setup");
      },
      start: () => {
        calls.push("start");
      },
    });

    await CrocoModule.initialize();

    expect(calls).toEqual(["setup", "start"]);
  });

  it("throws an error for circular dependencies", () => {
    const moduleAImports: ModuleOptions[] = [];
    const moduleBImports: ModuleOptions[] = [];
    const moduleCImports: ModuleOptions[] = [];
    const moduleA: ModuleOptions = { name: "A", setup: () => undefined, imports: moduleAImports };
    const moduleB: ModuleOptions = { name: "B", setup: () => undefined, imports: moduleBImports };
    const moduleC: ModuleOptions = { name: "C", setup: () => undefined, imports: moduleCImports };

    moduleAImports.push(moduleB);
    moduleBImports.push(moduleC);
    moduleCImports.push(moduleA);

    expect(() => detectCircularDependency([moduleA, moduleB, moduleC])).toThrow(
      ModuleCircularDependencyProblem,
    );
    expect(() => detectCircularDependency([moduleA, moduleB, moduleC])).toThrow(
      "Circular dependency detected: A → B → C → A",
    );
  });

  it("does not throw for acyclic dependencies", () => {
    const moduleC: ModuleOptions = { name: "C", setup: () => undefined };
    const moduleB: ModuleOptions = { name: "B", setup: () => undefined, imports: [moduleC] };
    const moduleA: ModuleOptions = { name: "A", setup: () => undefined, imports: [moduleB] };

    expect(detectCircularDependency([moduleA, moduleB, moduleC])).toBeNull();
  });

  it("throws a validation error when a module has no setup or start", () => {
    expect(() => CrocoModule.use({ name: "empty" })).toThrow(
      "Module 'empty' must define metadata or lifecycle hooks.",
    );
  });

  it("returns ModuleContext when initialized", async () => {
    CrocoModule.use({
      name: "app",
      setup: () => undefined,
    });

    const context = await CrocoModule.initialize();

    expect(context).toBeInstanceOf(ModuleContext);
  });

  it("exposes only exported providers to importing modules", async () => {
    const publicToken = new Token<string>("public-config");
    const privateToken = new Token<string>("private-config");
    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [
        { provide: publicToken, useValue: "public" },
        { provide: privateToken, useValue: "private" },
      ],
      exports: [publicToken],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      setup: (ctx) => {
        expect(ctx.get(publicToken)).toBe("public");
        expect(() => ctx.get(privateToken)).toThrow(ModuleProviderVisibilityProblem);
      },
    });

    await CrocoModule.initialize();
  });

  it("rejects class providers that inject non-exported imported providers", async () => {
    class PrivateDatabaseService {}

    class UserService {
      constructor(readonly database: PrivateDatabaseService) {}
    }

    Reflect.defineMetadata("design:paramtypes", [PrivateDatabaseService], UserService);

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [PrivateDatabaseService],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("rejects constructor token injections of non-exported imported providers", async () => {
    const privateToken = new Token<string>("private-config");

    class UserService {
      constructor(@Inject(privateToken) readonly secret: string) {}
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: privateToken, useValue: "secret" }],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("rejects property token injections of non-exported imported providers", async () => {
    const privateToken = new Token<string>("private-config");

    class UserService {
      @Inject(privateToken)
      secret: string | undefined;
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: privateToken, useValue: "secret" }],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("rejects undeclared global TypeDI services with constructor token injections", async () => {
    const privateToken = new Token<string>("private-config");

    @Component()
    class UserService {
      constructor(@Inject(privateToken) readonly secret: string) {}
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: privateToken, useValue: "secret" }],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      setup: (ctx) => {
        ctx.get(UserService);
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("rejects undeclared global TypeDI services with property token injections", async () => {
    const privateToken = new Token<string>("private-config");

    @Component()
    class UserService {
      @Inject(privateToken)
      secret: string | undefined;
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: privateToken, useValue: "secret" }],
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      setup: (ctx) => {
        ctx.get(UserService);
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("revalidates local class providers after dynamic provider ownership changes", async () => {
    const privateToken = new Token<string>("private-config");

    class UserService {
      constructor(@Inject(privateToken) readonly secret: string) {}
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      start: (ctx) => {
        ctx.set(privateToken, "secret");
      },
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      providers: [UserService],
      start: (ctx) => {
        ctx.get(UserService);
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("rejects exported tokens backed by undeclared global TypeDI class providers", async () => {
    const privateToken = new Token<string>("private-config");

    class DatabaseService {
      @Inject(privateToken)
      secret: string | undefined;
    }

    const serviceToken = new Token<DatabaseService>("database-service");
    Component(serviceToken)(DatabaseService);

    const databaseModule = defineCrocoModule({
      name: "database",
      exports: [serviceToken],
      start: (ctx) => {
        ctx.set(privateToken, "secret");
      },
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      start: (ctx) => {
        ctx.get(serviceToken);
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      cause: expect.any(ModuleProviderVisibilityProblem),
    });
  });

  it("validates exported class providers against their owning module", async () => {
    const privateToken = new Token<string>("private-config");

    class DatabaseService {
      @Inject(privateToken)
      secret: string | undefined;
    }

    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [DatabaseService],
      exports: [DatabaseService],
      start: (ctx) => {
        ctx.set(privateToken, "secret");
      },
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      start: (ctx) => {
        expect(ctx.get(DatabaseService).secret).toBe("secret");
      },
    });

    await CrocoModule.initialize();
  });

  it("allows exported token class providers declared with useClass to use owner private providers", async () => {
    const privateToken = new Token<string>("private-config");

    class DatabaseService {
      @Inject(privateToken)
      secret: string | undefined;
    }

    const serviceToken = new Token<DatabaseService>("database-service");
    const databaseModule = defineCrocoModule({
      name: "database",
      providers: [{ provide: serviceToken, useClass: DatabaseService }],
      exports: [serviceToken],
      start: (ctx) => {
        ctx.set(privateToken, "secret");
      },
    });

    CrocoModule.use({
      name: "users",
      imports: [databaseModule],
      start: (ctx) => {
        expect(ctx.get(serviceToken).secret).toBe("secret");
      },
    });

    await CrocoModule.initialize();
  });

  it("wraps lifecycle failures in a module Problem", async () => {
    const cause = new Error("database unavailable");

    CrocoModule.use({
      name: "database",
      start: () => {
        throw cause;
      },
    });

    await expect(CrocoModule.initialize()).rejects.toThrow(ModuleLifecycleProblem);
    await expect(CrocoModule.initialize()).rejects.toMatchObject({
      code: "framework-module/lifecycle-failed",
      message: "Module 'database' failed during start: database unavailable",
      cause,
    });
  });

  it("runs shutdown in reverse dependency order", async () => {
    const calls: string[] = [];
    const database: ModuleOptions = {
      name: "database",
      start: () => {
        calls.push("database:start");
      },
      shutdown: () => {
        calls.push("database:shutdown");
      },
    };

    CrocoModule.use({
      name: "api",
      imports: [database],
      start: () => {
        calls.push("api:start");
      },
      shutdown: () => {
        calls.push("api:shutdown");
      },
    });

    await CrocoModule.initialize();
    await CrocoModule.shutdown();

    expect(calls).toEqual(["database:start", "api:start", "api:shutdown", "database:shutdown"]);
  });

  it("reports module metadata through diagnostics", async () => {
    class UserController {}

    const configToken = new Token<string>("config");

    CrocoModule.use({
      name: "app",
      providers: [{ provide: configToken, useValue: "config" }],
      exports: [configToken],
      controllers: [UserController],
    });

    await CrocoModule.initialize();

    const health = await new ModuleDiagnosticsProvider().getHealth();

    expect(health.details).toMatchObject({
      registeredModuleCount: 1,
      initializedModuleCount: 1,
      modules: [
        {
          name: "app",
          phase: "started",
          providers: ["config"],
          exports: ["config"],
          controllers: ["UserController"],
        },
      ],
    });
  });
});
