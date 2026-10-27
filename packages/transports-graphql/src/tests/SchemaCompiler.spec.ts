import "reflect-metadata";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compileDiGraph, writeDiGraph } from "@croco/esbuild-plugin";
import * as frameworkContext from "@croco/framework-context";
import { Container, Context } from "@croco/framework-context";
import { createApplicationRuntime } from "@croco/framework-module";
import * as graphqlProtocol from "@croco/protocols-graphql";
import { GraphQLResolver, Query } from "@croco/protocols-graphql";
import { SchemaCompiler } from "../libs/SchemaCompiler";
import type { GeneratedDiGraph } from "@croco/framework-context";
import type * as GraphQL from "graphql";
import type * as Fixture from "./fixtures/schemaCompilerApp";

const { graphql } = createRequire(import.meta.url)("graphql") as typeof GraphQL;

describe("SchemaCompiler resolver injection", () => {
  beforeEach(() => Container.reset());
  afterEach(() => Container.reset());

  it("resolves generated constructor dependencies in the schema application and current request", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "croco-graphql-di-")));
    const fixture = resolve(import.meta.dirname, "fixtures/schemaCompilerApp.ts");
    let compiled: {
      generatedDiGraph: GeneratedDiGraph;
    } & typeof Fixture;
    try {
      const tsconfig = join(directory, "tsconfig.json");
      writeFileSync(
        tsconfig,
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            experimentalDecorators: true,
            paths: {
              "@croco/framework-context": [
                resolve(import.meta.dirname, "../../../framework-context/src/index.ts"),
              ],
              "@croco/protocols-graphql": [
                resolve(
                  import.meta.dirname,
                  "../../../protocols-graphql/src/libs/decorators/GraphQLResolver.ts",
                ),
              ],
            },
          },
        }),
      );
      const result = compileDiGraph({
        baseDir: directory,
        scanDirs: [fixture],
        exclude: [],
        tsconfig,
      });
      writeDiGraph(result);
      const bundle = await build({
        stdin: {
          contents: `export { generatedDiGraph } from ${JSON.stringify(result.outFile)}; export * from ${JSON.stringify(fixture)};`,
          resolveDir: directory,
        },
        bundle: true,
        write: false,
        format: "cjs",
        platform: "node",
        tsconfig,
        external: ["@croco/framework-context", "@croco/protocols-graphql"],
      });
      const loaded = { exports: {} };
      new Function("require", "module", "exports", bundle.outputFiles[0]?.text ?? "")(
        (specifier: string) => {
          if (specifier === "@croco/framework-context") return frameworkContext;
          if (specifier === "@croco/protocols-graphql") return graphqlProtocol;
          throw new Error(`Unexpected fixture dependency: ${specifier}`);
        },
        loaded,
        loaded.exports,
      );
      compiled = loaded.exports as typeof compiled;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    const { generatedDiGraph: generatedGraph, Dependency } = compiled;
    const first = createApplicationRuntime({ generatedGraph });
    const second = createApplicationRuntime({ generatedGraph });
    try {
      const firstSchema = await first.run(() => SchemaCompiler.compileSchema({ validate: false }));
      const secondSchema = await second.run(() =>
        SchemaCompiler.compileSchema({
          resolvers: [compiled.SingletonResolver, compiled.RequestResolver],
          autoDiscover: false,
          validate: false,
        }),
      );
      const execute = (schema: GraphQL.GraphQLSchema) =>
        graphql({ schema, source: "{ singleton request repeated: request }" });
      const [a, b] = await Context.run({ requestId: "shared-request" }, () =>
        Promise.all([execute(firstSchema), execute(secondSchema)]),
      );
      expect(a.errors).toBeUndefined();
      expect(b.errors).toBeUndefined();
      expect(a.data?.singleton).toBe(first.get(Dependency).id);
      expect(b.data?.singleton).toBe(second.get(Dependency).id);
      expect(a.data?.singleton).not.toBe(b.data?.singleton);
      expect(a.data?.request).toBe(a.data?.repeated);
      expect(a.data?.request).not.toBe(b.data?.request);
      const next = await Context.run({ requestId: "next-request" }, () => execute(firstSchema));
      expect(next.errors).toBeUndefined();
      expect(next.data?.singleton).toBe(a.data?.singleton);
      expect(next.data?.request).not.toBe(a.data?.request);
      const outsideRequest = await graphql({ schema: firstSchema, source: "{ request }" });
      expect(outsideRequest.errors?.[0]?.originalError).toMatchObject({
        code: "framework-context/request-scope-outside-context",
      });
      await first.dispose();
      const disposed = await graphql({ schema: firstSchema, source: "{ singleton }" });
      expect(disposed.errors?.[0]?.originalError).toMatchObject({
        code: "framework-context/container-scope-disposed",
      });
    } finally {
      await first.dispose();
      await second.dispose();
    }
  });

  it("preserves standalone optional constructors and rejects unregistered application resolvers", async () => {
    @GraphQLResolver()
    class ManualResolver {
      constructor(readonly value?: string) {}

      @Query(() => String)
      manual(): string {
        return this.value ?? "standalone";
      }
    }
    const schema = await SchemaCompiler.compileSchema({
      resolvers: [ManualResolver],
      autoDiscover: false,
      validate: false,
    });
    expect(await graphql({ schema, source: "{ manual }" })).toEqual({
      data: { manual: "standalone" },
    });
    @GraphQLResolver()
    class MissingResolver {
      @Query(() => String)
      missing(): string {
        return "unregistered";
      }
    }
    await expect(
      SchemaCompiler.compileSchema({
        resolvers: [MissingResolver],
        validate: false,
      }),
    ).rejects.toMatchObject({ code: "transports-graphql/resolver-container-required" });
  });

  it("preserves explicit custom container objects and getters", async () => {
    @GraphQLResolver()
    class CustomResolver {
      constructor(readonly value: string) {}
      @Query(() => String)
      custom(): string {
        return this.value;
      }
    }
    const container = { get: () => new CustomResolver("custom-container") };
    for (const configured of [container, () => container]) {
      const schema = await SchemaCompiler.compileSchema({
        resolvers: [CustomResolver],
        autoDiscover: false,
        container: configured,
        validate: false,
      });
      expect(await graphql({ schema, source: "{ custom }" })).toEqual({
        data: { custom: "custom-container" },
      });
    }
  });
});
