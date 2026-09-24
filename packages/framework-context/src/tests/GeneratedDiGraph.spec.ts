import { afterEach, describe, expect, it } from "vitest";
import {
  Container,
  Context,
  GENERATED_DI_GRAPH_VERSION,
  Token,
  defineGeneratedDiGraph,
} from "../index";

const SOURCE = { file: "src/services.ts", line: 1, column: 1 } as const;

describe("generated DI graph", () => {
  afterEach(() => {
    Container.reset();
  });

  it("does not register providers until an application installs the graph", () => {
    class Service {}
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
      ],
    });

    expect(Container.has(Service)).toBe(false);
    expect(() => Container.get(Service)).toThrow();

    Container.installGeneratedGraph(graph);

    expect(Container.has(Service)).toBe(true);
    expect(Container.get(Service)).toBeInstanceOf(Service);
  });

  it("isolates singleton instances between application scopes", () => {
    class Service {}
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.installGeneratedGraph(graph);
    const firstScope = Container.createScope();
    const secondScope = Container.createScope();

    const first = firstScope.run(() => Container.get(Service));
    const firstAgain = firstScope.run(() => Container.get(Service));
    const second = secondScope.run(() => Container.get(Service));

    expect(firstAgain).toBe(first);
    expect(second).not.toBe(first);
    firstScope.dispose();
    secondScope.dispose();
  });

  it("uses generated dependency metadata without reflection", () => {
    const CONFIG = new Token<string>("app.config");
    class Service {
      constructor(readonly config: string) {}
    }
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [
            {
              token: CONFIG,
              tokenId: "app:config",
              parameterIndex: 0,
              sourceLocation: SOURCE,
            },
          ],
          factory: (resolver) => new Service(resolver.get(CONFIG)),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.set(CONFIG, "ready");
    Container.installGeneratedGraph(graph);

    expect(Container.get(Service).config).toBe("ready");
    expect(Container.createDependencyGraphManifest({ roots: [Service] })).toMatchObject({
      status: "ready",
      rootIds: ["app:Service"],
      providers: expect.arrayContaining([
        expect.objectContaining({ tokenId: "app:Service", dependencyIds: ["app:config"] }),
      ]),
    });
  });

  it("reuses request providers only inside the same request", () => {
    class RequestService {}
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [RequestService],
      providers: [
        {
          token: RequestService,
          tokenId: "app:RequestService",
          debugName: "RequestService",
          scope: "request",
          dependencies: [],
          factory: () => new RequestService(),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.installGeneratedGraph(graph);

    expect(() => Container.get(RequestService)).toThrow(/Request-scoped/);
    const first = Context.run({ requestId: "first" }, () => [
      Container.get(RequestService),
      Container.get(RequestService),
    ]);
    const second = Context.run({ requestId: "second" }, () => Container.get(RequestService));

    expect(first[0]).toBe(first[1]);
    expect(second).not.toBe(first[0]);
  });

  it("keeps request instances separate when one context enters two application scopes", () => {
    class RequestService {}
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.shared-request-graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [RequestService],
      providers: [
        {
          token: RequestService,
          tokenId: "app:RequestService",
          debugName: "RequestService",
          scope: "request",
          dependencies: [],
          factory: () => new RequestService(),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.installGeneratedGraph(graph);
    const firstScope = Container.createScope();
    const secondScope = Container.createScope();

    const [first, second, firstAgain] = Context.run({ requestId: "shared" }, () => [
      firstScope.run(() => Container.get(RequestService)),
      secondScope.run(() => Container.get(RequestService)),
      firstScope.run(() => Container.get(RequestService)),
    ]);

    expect(first).not.toBe(second);
    expect(firstAgain).toBe(first);
    firstScope.dispose();
    secondScope.dispose();
  });

  it("disposes request aliases once after the outer request, including rejected work", async () => {
    let disposed = 0;
    class RequestService {
      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    const ALIAS = new Token<RequestService>("request.alias");
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.request-disposal",
        compilerVersion: "test",
        inputHash: "input",
        roots: [RequestService],
        providers: [
          {
            token: RequestService,
            tokenId: "app:RequestService",
            debugName: "RequestService",
            scope: "request",
            dependencies: [],
            factory: () => new RequestService(),
            sourceLocation: SOURCE,
          },
          {
            token: ALIAS,
            tokenId: "app:RequestAlias",
            debugName: "RequestAlias",
            scope: "request",
            dependencies: [{ token: RequestService, tokenId: "app:RequestService" }],
            factory: (resolver) => resolver.get(RequestService),
            sourceLocation: SOURCE,
          },
        ],
      }),
    );

    Context.run({ requestId: "success" }, () => {
      const service = Container.get(ALIAS);
      Context.run(
        { requestId: "nested" },
        () => expect(Container.get(RequestService)).toBe(service),
        { inheritScope: true },
      );
      expect(disposed).toBe(0);
    });
    expect(disposed).toBe(1);

    const failure = new Error("request failed");
    await expect(
      Context.run({ requestId: "failure" }, async () => {
        Container.get(ALIAS);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(disposed).toBe(2);
  });

  it("disposes transient instances at their request or application boundary", () => {
    let disposed = 0;
    class TransientService {
      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.transient-disposal",
        compilerVersion: "test",
        inputHash: "input",
        roots: [TransientService],
        providers: [
          {
            token: TransientService,
            tokenId: "app:TransientService",
            debugName: "TransientService",
            scope: "transient",
            dependencies: [],
            factory: () => new TransientService(),
            sourceLocation: SOURCE,
          },
        ],
      }),
    );
    const scope = Container.createScope();
    scope.run(() => {
      const first = Container.get(TransientService);
      const second = Container.get(TransientService);
      expect(first).not.toBe(second);
      Context.run({ requestId: "transient" }, () => {
        Container.get(TransientService);
        expect(disposed).toBe(0);
      });
      expect(disposed).toBe(1);
    });

    scope.dispose();
    expect(disposed).toBe(3);
  });

  it("rejects a singleton capturing a transient dependency", () => {
    let disposed = 0;
    class TransientService {
      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    class SingletonService {
      constructor(readonly dependency: TransientService) {}
    }
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.singleton-transient",
        compilerVersion: "test",
        inputHash: "input",
        roots: [SingletonService],
        providers: [
          {
            token: TransientService,
            tokenId: "app:TransientService",
            debugName: "TransientService",
            scope: "transient",
            dependencies: [],
            factory: () => new TransientService(),
            sourceLocation: SOURCE,
          },
          {
            token: SingletonService,
            tokenId: "app:SingletonService",
            debugName: "SingletonService",
            scope: "singleton",
            dependencies: [
              { token: TransientService, tokenId: "app:TransientService", parameterIndex: 0 },
            ],
            factory: (resolver) => new SingletonService(resolver.get(TransientService)),
            sourceLocation: SOURCE,
          },
        ],
      }),
    );
    const scope = Container.createScope();
    scope.run(() => {
      expect(() =>
        Context.run({ requestId: "first" }, () => Container.get(SingletonService)),
      ).toThrow(/cannot depend on transient-scoped component TransientService/);
      expect(disposed).toBe(0);
    });
    scope.dispose();
    expect(disposed).toBe(0);
  });

  it("disposes generated singletons with their owning application scope", () => {
    let disposed = 0;
    class Service {
      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.installGeneratedGraph(graph);
    const scope = Container.createScope();
    scope.run(() => Container.get(Service));

    scope.dispose();

    expect(disposed).toBe(1);
  });

  it("disposes one singleton only once when a generated token aliases it", () => {
    let disposed = 0;
    const ALIAS = new Token<Service>("service.alias");
    class Service {
      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.alias-disposal",
      compilerVersion: "test",
      inputHash: "input",
      roots: [Service],
      providers: [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
        {
          token: ALIAS,
          tokenId: "app:Alias",
          debugName: "Alias",
          scope: "singleton",
          dependencies: [{ token: Service, tokenId: "app:Service" }],
          factory: (resolver) => resolver.get(Service),
          sourceLocation: SOURCE,
        },
      ],
    });
    Container.installGeneratedGraph(graph);
    const scope = Container.createScope();
    scope.run(() => Container.get(ALIAS));

    scope.dispose();

    expect(disposed).toBe(1);
  });

  it("releases nullable and primitive module values without disposal hooks", () => {
    const scope = Container.createScope();
    scope.run(() => {
      Container.set(new Token<null>("null-value"), null);
      Container.set(new Token<undefined>("undefined-value"), undefined);
      Container.set(new Token<string>("string-value"), "ready");
    });

    expect(() => scope.dispose()).not.toThrow();
  });

  it("publishes a replacement only to scopes created after the graph swap", () => {
    class Service {
      constructor(readonly version: string) {}
    }
    const createGraph = (inputHash: string, version: string) =>
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.graph",
        compilerVersion: "test",
        inputHash,
        roots: [Service],
        providers: [
          {
            token: Service,
            tokenId: "app:Service",
            debugName: "Service",
            scope: "singleton",
            dependencies: [],
            factory: () => new Service(version),
            sourceLocation: SOURCE,
          },
        ],
      });
    Container.installGeneratedGraph(createGraph("first", "first"));
    const inFlightScope = Container.createScope();
    expect(inFlightScope.run(() => Container.get(Service).version)).toBe("first");

    Container.installGeneratedGraph(createGraph("second", "second"));
    const nextScope = Container.createScope();

    expect(inFlightScope.run(() => Container.get(Service).version)).toBe("first");
    expect(nextScope.run(() => Container.get(Service).version)).toBe("second");
    inFlightScope.dispose();
    nextScope.dispose();
  });

  it("disposes a replaced singleton owned by the global composition scope", () => {
    let disposed = 0;
    class Service {
      constructor(readonly version: string) {}

      [Symbol.dispose](): void {
        disposed += 1;
      }
    }
    const createGraph = (inputHash: string, version: string) =>
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "test.graph",
        compilerVersion: "test",
        inputHash,
        roots: [Service],
        providers: [
          {
            token: Service,
            tokenId: "app:Service",
            debugName: "Service",
            scope: "singleton",
            dependencies: [],
            factory: () => new Service(version),
            sourceLocation: SOURCE,
          },
        ],
      });

    Container.installGeneratedGraph(createGraph("first", "first"));
    expect(Container.get(Service).version).toBe("first");

    Container.installGeneratedGraph(createGraph("second", "second"));

    expect(disposed).toBe(1);
    expect(Container.get(Service).version).toBe("second");
  });

  it("rejects conflicting generated token identities before resolving factories", () => {
    const first = new Token<string>("first");
    const second = new Token<string>("second");
    const graph = defineGeneratedDiGraph({
      version: GENERATED_DI_GRAPH_VERSION,
      graphId: "test.graph",
      compilerVersion: "test",
      inputHash: "input",
      roots: [first],
      providers: [
        {
          token: first,
          tokenId: "app:shared",
          debugName: "first",
          scope: "singleton",
          dependencies: [],
          factory: () => "first",
          sourceLocation: SOURCE,
        },
        {
          token: second,
          tokenId: "app:shared",
          debugName: "second",
          scope: "singleton",
          dependencies: [],
          factory: () => "second",
          sourceLocation: SOURCE,
        },
      ],
    });

    expect(() => Container.installGeneratedGraph(graph)).toThrow(/owned by more than one/);
    expect(Container.has(first)).toBe(false);
  });
});
