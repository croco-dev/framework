import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  compileDiGraph,
  createDiPackageDescriptor,
  writeDiGraph,
  writeDiPackageDescriptor,
} from "@croco/esbuild-plugin";
import type { DiCompilerOptions } from "@croco/esbuild-plugin";

const require = createRequire(import.meta.url);
const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(join(tmpdir(), "croco-next-di-"));
const roots = [join(temporary, "first"), join(temporary, "second")];
const component = 'import { Component } from "@croco/framework-context";';
const initial = `${component}
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
@Component() export class Probe {
  id = randomUUID();
  value() { return 'initial'; }
  [Symbol.dispose]() { appendFileSync(process.env.CROCO_DI_SMOKE_DISPOSALS as string, this.id + '\\n'); }
}`;
const dependent = `${component}
import { Dependency } from './Dependency';
@Component() export class Probe {
  constructor(private dependency: Dependency) {}
  value() { return this.dependency.value; }
}`;
const route = `import { withApplication } from '../../../server/application';
import { Probe } from '../../../server/Probe';
export const GET = () => withApplication(application => Response.json({
  value: application.get(Probe).value(), scope: application.scopeId,
}));`;

function write(root: string, file: string, body: string) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(`${target}.tmp`, body);
  renameSync(`${target}.tmp`, target);
}

async function until<T>(
  description: string,
  observe: () => T | Promise<T>,
  accepted: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + 45_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await observe();
      if (accepted(value)) return value;
      last = value;
    } catch (error) {
      last = error;
    }
    await delay(100);
  }
  throw new Error(`${description}: ${String(last)}`);
}

async function start(root: string) {
  mkdirSync(root, { recursive: true });
  symlinkSync(join(source, "node_modules"), join(root, "node_modules"), "dir");
  for (const file of [
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "scripts/di.mjs",
    "di.config.json",
    "src/server/application.ts",
  ]) {
    if (existsSync(join(source, file))) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(join(source, file), join(root, file));
    }
  }
  write(
    root,
    "src/app/layout.tsx",
    "export default function Layout({children}:{children:React.ReactNode}) { return <html><body>{children}</body></html>; }",
  );
  write(
    root,
    "src/app/page.tsx",
    "export default function Page(){return <main>DI development fixture</main>}",
  );
  write(root, "src/server/Probe.ts", initial);
  write(root, "src/app/api/probe/route.ts", route);
  write(root, "src/app/api/mirror/route.ts", route);
  writeDiGraph(compileDiGraph({ baseDir: root }));
  const listener = createServer();
  await new Promise<void>((done, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", done);
  });
  const address = listener.address();
  assert(address && typeof address !== "string");
  await new Promise<void>((done, reject) =>
    listener.close((error) => (error ? reject(error) : done())),
  );
  const origin = `http://127.0.0.1:${address.port}`;
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(address.port),
    ],
    {
      cwd: root,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        CROCO_DI_SMOKE_DISPOSALS: join(root, "disposals.txt"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stdout.on("data", (data) => {
    logs += String(data);
  });
  child.stderr.on("data", (data) => {
    logs += String(data);
  });
  const closed = new Promise<void>((done) => child.once("close", () => done()));
  let spawnFailure: Error | undefined;
  child.once("error", (error) => {
    spawnFailure = error;
  });
  function signal(signal: NodeJS.Signals) {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH"))
        throw error;
    }
  }
  async function stop() {
    if (child.exitCode === null && child.signalCode === null) {
      signal("SIGTERM");
      const timeout = setTimeout(() => signal("SIGKILL"), 5_000);
      try {
        await closed;
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  async function value(expected: string, endpoint = "probe") {
    return until(
      `HTTP ${endpoint} should return ${expected}`,
      async () => {
        if (spawnFailure) throw spawnFailure;
        assert.equal(child.exitCode, null, logs);
        const response = await fetch(`${origin}/api/${endpoint}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status !== 200) return { value: `HTTP ${response.status}`, scope: "" };
        return (await response.json()) as { value: string; scope: string };
      },
      (result) => result.value === expected,
    );
  }
  function manifest() {
    return JSON.parse(readFileSync(join(root, ".croco/di.manifest.json"), "utf8")) as {
      inputHash: string;
      packages: { packageVersion: string }[];
      providers: { exportName: string; scope: string }[];
    };
  }
  async function failed() {
    await until(
      "failed compilation marker",
      () =>
        JSON.parse(readFileSync(join(root, ".croco/di.development.json"), "utf8")) as {
          status: string;
        },
      (state) => state.status === "failed",
    );
    const status = await until(
      "HTTP responds for the invalid graph",
      async () => {
        const response = await fetch(`${origin}/api/probe`, {
          signal: AbortSignal.timeout(10_000),
        });
        return response.status;
      },
      () => true,
    );
    assert(status >= 500, "invalid edit must not succeed with the old graph");
    assert.match(logs, /CROCO_DI_COMPILE_|error TS|Syntax ?Error/);
  }
  function diagnostics() {
    let state: unknown;
    try {
      state = JSON.parse(readFileSync(join(root, ".croco/di.development.json"), "utf8"));
      const options = JSON.parse(readFileSync(join(root, "di.config.json"), "utf8")) as Omit<
        DiCompilerOptions,
        "baseDir"
      >;
      const result = compileDiGraph({ ...options, baseDir: root });
      return { state, currentInputHash: result.manifest.inputHash, watchFiles: result.watchFiles };
    } catch (error) {
      return { state, diagnosticError: String(error) };
    }
  }
  return { value, manifest, failed, stop, diagnostics, logs: () => logs };
}

const servers: Awaited<ReturnType<typeof start>>[] = [];
try {
  const root = roots[0];
  assert(root);
  const first = await start(root);
  servers.push(first);
  await first.value("initial");
  // An unreferenced service must be discovered before any route imports it.
  write(
    root,
    "src/server/Dependency.ts",
    `${component} @Component() export class Dependency { value = 'edited'; }`,
  );
  await until("unreferenced provider discovery", first.manifest, (manifest) =>
    manifest.providers.some((provider) => provider.exportName === "Dependency"),
  );
  write(root, "src/server/Probe.ts", dependent);
  await first.value("edited");
  await first.value("edited", "mirror");
  await first.value("edited");
  assert(existsSync(join(root, "disposals.txt")), "the previous graph runtime must be disposed");

  const goodHash = first.manifest().inputHash;
  write(root, "src/server/Dependency.ts", `${component} @Component() export class Dependency {`);
  await first.failed();
  assert.equal(
    first.manifest().inputHash,
    goodHash,
    "failed compilation cannot publish a partial pair",
  );
  write(
    root,
    "src/server/Dependency.ts",
    `${component} @Component() export class Dependency { value = 'recovered'; }`,
  );
  await first.value("recovered");

  write(
    root,
    "src/server/Probe.ts",
    `${component} interface Missing { value: string } @Component() export class Probe { constructor(private dependency: Missing) {} value(){return this.dependency.value} }`,
  );
  await first.failed();
  write(root, "src/server/Probe.ts", dependent);
  await first.value("recovered");
  write(
    root,
    "src/server/Cycle.ts",
    `${component} @Component() export class A { constructor(readonly b: B) {} } @Component() export class B { constructor(readonly a: A) {} }`,
  );
  await first.failed();
  rmSync(join(root, "src/server/Cycle.ts"));
  await first.value("recovered");

  write(
    root,
    "src/server/Port.ts",
    "import { Token } from '@croco/framework-context'; export const PORT = new Token<{ value: string }>('dependency');",
  );
  write(
    root,
    "src/server/Probe.ts",
    `${component} import { Inject } from '@croco/framework-context'; import { PORT } from './Port'; @Component() export class Probe { constructor(@Inject(PORT) private dependency: { value: string }) {} value(){return this.dependency.value} }`,
  );
  write(
    root,
    "di.config.json",
    JSON.stringify({
      bindings: [
        {
          token: { moduleSpecifier: "./src/server/Port", exportName: "PORT" },
          useExisting: { moduleSpecifier: "./src/server/Dependency", exportName: "Dependency" },
        },
      ],
    }),
  );
  await first.value("recovered");
  write(root, "src/server/Probe.ts", dependent);
  write(root, "di.config.json", "{}");
  rmSync(join(root, "src/server/Port.ts"));
  await first.value("recovered");

  write(
    root,
    "src/server/Probe.ts",
    dependent
      .replaceAll("Dependency", "Renamed")
      .replace("@Component()", "@Component({ scope: 'transient' })"),
  );
  renameSync(join(root, "src/server/Dependency.ts"), join(root, "src/server/Renamed.ts"));
  write(
    root,
    "src/server/Renamed.ts",
    `${component} @Component({ scope: 'transient' }) export class Renamed { value = 'renamed'; }`,
  );
  await first.value("renamed");
  assert(
    first
      .manifest()
      .providers.some(
        (provider) => provider.exportName === "Renamed" && provider.scope === "transient",
      ),
  );
  assert(!first.manifest().providers.some((provider) => provider.exportName === "Dependency"));

  write(
    root,
    "src/server/Probe.ts",
    `${component} @Component() export class Probe { value(){return 'removed'} }`,
  );
  rmSync(join(root, "src/server/Renamed.ts"));
  await first.value("removed");
  assert(!first.manifest().providers.some((provider) => provider.exportName === "Renamed"));

  // Config errors and missing local descriptors remain watched and recover in process.
  write(root, "di.config.json", JSON.stringify({ packageDescriptors: ["./descriptor.json"] }));
  await first.failed();
  write(root, "di.config.json", "{}");
  await first.value("removed");

  const library = compileDiGraph({
    baseDir: root,
    scanDirs: [],
    graphId: "fixture",
    packageName: "fixture",
    outFile: "external/graph.ts",
    manifestFile: "external/manifest.json",
  });
  writeDiGraph(library);
  const descriptor = createDiPackageDescriptor(library, {
    packageName: "fixture",
    packageVersion: "1.0.0",
    graphImport: "./graph.ts",
  });
  writeDiPackageDescriptor(join(root, "external/descriptor.json"), descriptor);
  write(
    root,
    "external/compiler.json",
    JSON.stringify({ extends: "../tsconfig.json", compilerOptions: { target: "ES2018" } }),
  );
  write(
    root,
    "di.config.json",
    JSON.stringify({
      packageDescriptors: ["./external/descriptor.json"],
      tsconfig: "external/compiler.json",
    }),
  );
  await until(
    "selected descriptor",
    first.manifest,
    (manifest) => manifest.packages[0]?.packageVersion === "1.0.0",
  );
  await first.value("removed");
  const configuredHash = first.manifest().inputHash;
  write(
    root,
    "external/compiler.json",
    JSON.stringify({ extends: "../tsconfig.json", compilerOptions: { target: "ES2020" } }),
  );
  await until(
    "custom compiler config update",
    first.manifest,
    (manifest) => manifest.inputHash !== configuredHash,
  );
  await first.value("removed");
  write(
    root,
    "external/descriptor.json",
    JSON.stringify({ ...descriptor, compilerVersion: "unsupported" }),
  );
  await first.failed();
  writeDiPackageDescriptor(join(root, "external/descriptor.json"), {
    ...descriptor,
    packageVersion: "1.0.1",
  });
  await until(
    "descriptor recovery",
    first.manifest,
    (manifest) => manifest.packages[0]?.packageVersion === "1.0.1",
  );
  await first.value("removed");

  write(root, "token-fixture/Tokens.ts", "export {};");
  write(
    root,
    "di.config.json",
    JSON.stringify({
      bindings: [
        {
          token: { moduleSpecifier: "./token-fixture/Tokens", exportName: "EXTERNAL" },
          useExisting: { moduleSpecifier: "./src/server/Probe", exportName: "Probe" },
        },
      ],
    }),
  );
  await first.failed();
  write(
    root,
    "token-fixture/Tokens.ts",
    "import { Token } from '@croco/framework-context'; export const EXTERNAL = new Token<{value(): string}>('external');",
  );
  await first.value("removed");

  const secondRoot = roots[1];
  assert(secondRoot);
  const second = await start(secondRoot);
  servers.push(second);
  await second.value("initial");
  write(
    root,
    "src/server/Probe.ts",
    `${component} @Component() export class Probe { value(){return 'first-only'} }`,
  );
  await Promise.all([first.value("first-only", "mirror"), second.value("initial", "mirror")]);
  await Promise.all([first.value("first-only"), second.value("initial")]);
  console.log(
    "Next DI development: discovery, injection, cleanup, invalid-edit recovery, rename, deletion, config recovery and two-app isolation pass.",
  );
} catch (error) {
  for (const server of servers) {
    console.error("DI development failure state:", JSON.stringify(server.diagnostics()));
    console.error(server.logs());
  }
  throw error;
} finally {
  await Promise.all(servers.map((server) => server.stop()));
  rmSync(temporary, { force: true, recursive: true });
}
