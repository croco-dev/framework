import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { Problem, ProblemCategory } from "@croco/problems-core";

const source = readFileSync(
  fileURLToPath(
    new URL(
      "../../templates/addons/trpc-nextjs/apps/web/src/server/application.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);
const compiled = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText;

type Application = {
  graph: object;
  run: <T>(callback: () => T) => T;
  dispose: () => Promise<void>;
};
type WithApplication = <T>(callback: (application: Application) => T | Promise<T>) => Promise<T>;

function fixture() {
  const shared: Record<symbol, unknown> = {};
  const states = new Map<string, { status: string; inputHash: string; revision: string }>();
  const runtimes: Application[] = [];
  function load(inputHash: string, root = "first", revision = inputHash) {
    const graph = { inputHash };
    const stateFile = `${root}/state.json`;
    states.set(stateFile, { status: "ready", inputHash, revision });
    const exports: { withApplication?: WithApplication } = {};
    runInNewContext(compiled, {
      exports,
      globalThis: shared,
      process: { env: { NODE_ENV: "development", CROCO_DI_DEV_STATE: stateFile } },
      require: (specifier: string) => {
        if (specifier === "reflect-metadata") return {};
        if (specifier === "node:fs")
          return { readFileSync: (file: string) => JSON.stringify(states.get(file)) };
        if (specifier === "@croco/problems-core") return { Problem, ProblemCategory };
        if (specifier === "../../.croco/di.generated") return { generatedDiGraph: graph };
        if (specifier === "@croco/framework-module")
          return {
            createApplicationRuntime: (_options: object, selected: object) => {
              const runtime = {
                graph: selected,
                run: <T>(callback: () => T) => callback(),
                dispose: vi.fn(async () => undefined),
              };
              runtimes.push(runtime);
              return runtime;
            },
          };
        throw new Error(`Unexpected import ${specifier}`);
      },
    });
    const callback = exports.withApplication;
    if (!callback) throw new Error("Missing withApplication export");
    return { withApplication: callback, graph, stateFile };
  }
  return { load, states, runtimes };
}

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("Next development application lifecycle", () => {
  it("keeps bundle-local constructor graphs distinct and reuses each live scope", async () => {
    const { load, runtimes } = fixture();
    const first = load("one");
    const second = load("one");
    const a = await first.withApplication((app) => app);
    const b = await second.withApplication((app) => app);
    expect(a.graph).toBe(first.graph);
    expect(b.graph).toBe(second.graph);
    expect(a).not.toBe(b);
    expect(await first.withApplication((app) => app)).toBe(a);
    expect(runtimes).toHaveLength(2);
  });

  it("drains an active callback before disposing its revision and serving the next one", async () => {
    const { load, runtimes } = fixture();
    const first = load("one");
    const entered = deferred();
    const finish = deferred();
    const active = first.withApplication(async (app) => {
      entered.release();
      await finish.promise;
      return app;
    });
    await entered.promise;
    const second = load("two");
    const nextCallback = vi.fn((app: Application) => app);
    const next = second.withApplication(nextCallback);
    await Promise.resolve();
    expect(nextCallback).not.toHaveBeenCalled();
    expect(runtimes[0]?.dispose).not.toHaveBeenCalled();
    finish.release();
    const old = await active;
    const current = await next;
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(current.graph).toBe(second.graph);
    expect(current).not.toBe(old);
  });

  it("rejects stale, rebuilding and invalid graphs without running callbacks", async () => {
    const { load, states } = fixture();
    const first = load("one");
    await first.withApplication(() => undefined);
    load("two");
    const callback = vi.fn();
    await expect(first.withApplication(callback)).rejects.toMatchObject({
      code: "CROCO_DI_DEVELOPMENT_UNAVAILABLE",
    });
    for (const status of ["building", "failed"]) {
      states.set(first.stateFile, { status, inputHash: "one", revision: "one" });
      await expect(first.withApplication(callback)).rejects.toMatchObject({
        code: "CROCO_DI_DEVELOPMENT_UNAVAILABLE",
      });
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it("retires old scopes even when a webpack rebuild leaves the input hash unchanged", async () => {
    const { load } = fixture();
    const first = load("one", "first", "build-1");
    const old = await first.withApplication((app) => app);
    const second = load("one", "first", "build-2");
    const next = await second.withApplication((app) => app);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(next).not.toBe(old);
  });

  it("replaces only the owning app and preserves another app runtime", async () => {
    const { load } = fixture();
    const first = load("one", "first");
    const second = load("one", "second");
    const firstRuntime = await first.withApplication((app) => app);
    const secondRuntime = await second.withApplication((app) => app);
    const edited = load("two", "first");
    await edited.withApplication(() => undefined);
    expect(firstRuntime.dispose).toHaveBeenCalledOnce();
    expect(secondRuntime.dispose).not.toHaveBeenCalled();
    expect(await second.withApplication((app) => app)).toBe(secondRuntime);
  });
});
