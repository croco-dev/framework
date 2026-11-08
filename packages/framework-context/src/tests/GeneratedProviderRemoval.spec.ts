import { afterEach, describe, expect, it } from "vitest";
import { Container, GENERATED_DI_GRAPH_VERSION, Token, defineGeneratedDiGraph } from "../index";
import type { GeneratedProviderDefinition } from "../index";

const SOURCE = { file: "src/services.ts", line: 7, column: 3 } as const;

function graph(graphId: string, providers: readonly GeneratedProviderDefinition[]) {
  return defineGeneratedDiGraph({
    version: GENERATED_DI_GRAPH_VERSION,
    graphId,
    compilerVersion: "test",
    inputHash: graphId,
    roots: providers.map((provider) => provider.token),
    providers,
  });
}

describe("generated provider removal", () => {
  afterEach(() => Container.reset());

  describe.each(["root", "application"] as const)("%s container", (target) => {
    it("keeps a removed singleton absent through unrelated graph changes until explicit reinstall", () => {
      let disposed = 0;
      class Service {
        [Symbol.dispose](): void {
          disposed += 1;
        }
      }
      const KEEP = new Token<object>("keep");
      const original = graph("original", [
        {
          token: Service,
          tokenId: "app:Service",
          debugName: "Service",
          kind: "rest-controller",
          scope: "singleton",
          dependencies: [],
          factory: () => new Service(),
          sourceLocation: SOURCE,
        },
        {
          token: KEEP,
          tokenId: "app:keep",
          debugName: "keep",
          scope: "singleton",
          dependencies: [],
          factory: () => ({}),
          sourceLocation: SOURCE,
        },
      ]);
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(original);
        const instance = Container.get(Service);
        const kept = Container.get(KEEP);
        Container.remove(Service);

        expect(Container.has(Service)).toBe(false);
        expect(disposed).toBe(1);
        expect(Container.getComponentMetadata(Service)).toBeUndefined();
        expect(Container.getGeneratedProviderTokens("rest-controller")).toEqual([]);
        expect(() => Container.get(Service)).toThrow();

        Container.installGeneratedGraph(graph("unrelated", []));
        Container.removeGeneratedGraph("unrelated");
        expect(Container.has(Service)).toBe(false);
        expect(() => Container.get(Service)).toThrow();
        expect(Container.get(KEEP)).toBe(kept);
        Container.remove(Service);
        expect(disposed).toBe(1);

        Container.installGeneratedGraph(original);
        expect(Container.get(Service)).not.toBe(instance);
        expect(Container.get(KEEP)).toBe(kept);
        expect(Container.createDependencyGraphManifest({ roots: [Service] })).toMatchObject({
          status: "ready",
          rootIds: ["app:Service"],
        });
        expect(Container.getComponentMetadata(Service)?.scope).toBe("singleton");
        expect(original.providers).toHaveLength(2);
        Container.removeGeneratedGraph("original");
        expect(disposed).toBe(2);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(2);
    });

    it("removes every multi binding while retaining a shared singleton owned by another token", () => {
      let disposed = 0;
      const shared = {
        destroy: () => {
          disposed += 1;
        },
      };
      const other = {
        destroy: () => {
          disposed += 10;
        },
      };
      const MULTI = new Token<object>("multi");
      const KEEP = new Token<object>("keep");
      const provider = (
        token: Token<object>,
        value: object,
        multiple = false,
      ): GeneratedProviderDefinition => ({
        token,
        tokenId: token === MULTI ? "app:multi" : "app:keep",
        debugName: token === MULTI ? "multi" : "keep",
        scope: "singleton",
        multiple,
        dependencies: [],
        factory: () => value,
        sourceLocation: SOURCE,
      });
      const scope = target === "application" ? Container.createScope() : undefined;
      const run = () => {
        Container.installGeneratedGraph(graph("first", [provider(MULTI, shared, true)]));
        Container.installGeneratedGraph(
          graph("second", [provider(MULTI, other, true), provider(KEEP, shared)]),
        );
        expect(Container.getMany(MULTI)).toEqual([shared, other]);
        expect(Container.get(KEEP)).toBe(shared);

        Container.remove(MULTI);
        expect(disposed).toBe(10);
        expect(Container.getMany(MULTI)).toEqual([]);
        Container.installGeneratedGraph(graph("unrelated", []));
        Container.removeGeneratedGraph("unrelated");
        expect(Container.has(MULTI)).toBe(false);
        expect(Container.get(KEEP)).toBe(shared);
        Container.remove(KEEP);
        expect(disposed).toBe(11);
        Container.removeGeneratedGraph("first");
        Container.removeGeneratedGraph("second");
        expect(disposed).toBe(11);
      };
      try {
        if (scope) scope.run(run);
        else run();
      } finally {
        scope?.dispose();
      }
      expect(disposed).toBe(11);
    });

    it.each(["same token", "another token"] as const)(
      "preserves runtime ownership for %s",
      (binding) => {
        let disposed = 0;
        const shared = {
          destroy: () => {
            disposed += 1;
          },
        };
        const SERVICE = new Token<object>("service");
        const KEEP = new Token<object>("keep");
        const scope = target === "application" ? Container.createScope() : undefined;
        const run = () => {
          Container.installGeneratedGraph(
            graph("original", [
              {
                token: SERVICE,
                tokenId: "app:service",
                debugName: "service",
                scope: "singleton",
                dependencies: [],
                factory: () => shared,
                sourceLocation: SOURCE,
              },
            ]),
          );
          expect(Container.get(SERVICE)).toBe(shared);
          Container.set(binding === "same token" ? SERVICE : KEEP, shared);
          Container.remove(SERVICE);
          expect(disposed).toBe(binding === "same token" ? 1 : 0);
          if (binding === "another token") {
            expect(Container.get(KEEP)).toBe(shared);
            Container.remove(KEEP);
          }
          expect(disposed).toBe(1);
          Container.removeGeneratedGraph("original");
        };
        try {
          if (scope) scope.run(run);
          else run();
        } finally {
          scope?.dispose();
        }
        expect(disposed).toBe(1);
      },
    );
  });

  it("keeps removals local to each application snapshot and copies root removals to new scopes", () => {
    const SERVICE = new Token<object>("service");
    const original = graph("original", [
      {
        token: SERVICE,
        tokenId: "app:service",
        debugName: "service",
        scope: "singleton",
        dependencies: [],
        factory: () => ({}),
        sourceLocation: SOURCE,
      },
    ]);
    Container.installGeneratedGraph(original);
    const first = Container.createScope();
    const second = Container.createScope();
    try {
      const secondInstance = second.run(() => Container.get(SERVICE));
      first.run(() => {
        Container.remove(SERVICE);
        Container.installGeneratedGraph(graph("unrelated", []));
        expect(Container.has(SERVICE)).toBe(false);
      });
      expect(second.run(() => Container.get(SERVICE))).toBe(secondInstance);
      expect(Container.has(SERVICE)).toBe(true);

      Container.remove(SERVICE);
      const next = Container.createScope();
      try {
        next.run(() => {
          Container.installGeneratedGraph(graph("unrelated", []));
          expect(Container.has(SERVICE)).toBe(false);
        });
        expect(second.run(() => Container.get(SERVICE))).toBe(secondInstance);
      } finally {
        next.dispose();
      }
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
