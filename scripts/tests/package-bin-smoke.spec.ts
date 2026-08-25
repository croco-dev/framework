import { spawnSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { replaceInstalledPackageFile, restoreInstalledPackageFile } from "../package-bin-smoke.mts";

const scriptPath = resolve(__dirname, "../package-bin-smoke.mts");
const tempRoots: string[] = [];
const spawnTimeoutMs = 180_000;

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("package-bin-smoke.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("replaces an installed fixture without mutating a hardlinked source file", () => {
    const root = createTempRoot();
    const sourcePath = join(root, "source-cli.js");
    const installedPath = join(root, "installed-cli.js");
    writeFileSync(sourcePath, "original\n");
    linkSync(sourcePath, installedPath);

    const replacement = replaceInstalledPackageFile(root, installedPath, "stub\n");

    expect(readFileSync(sourcePath, "utf8")).toBe("original\n");
    expect(readFileSync(installedPath, "utf8")).toBe("stub\n");
    expect(readFileSync(`${installedPath}.croco-bin-smoke-original`, "utf8")).toBe("original\n");

    restoreInstalledPackageFile(replacement);

    expect(readFileSync(sourcePath, "utf8")).toBe("original\n");
    expect(readFileSync(installedPath, "utf8")).toBe("original\n");
    expect(existsSync(`${installedPath}.croco-bin-smoke-original`)).toBe(false);
  });

  it(
    "installs packed bins with transitive internal peer tarball overrides",
    () => {
      const root = createTempRoot();
      writeHelperPackage(root);
      writeBridgePackage(root);
      writeBinPackage(root, {
        commandName: "croco-openapi-spec",
        dependencies: {
          "@croco/bin-bridge": "0.0.0",
        },
        script: [
          "#!/usr/bin/env node",
          'import dgram from "node:dgram";',
          'import dns from "node:dns";',
          'import { readFileSync } from "node:fs";',
          'import net from "node:net";',
          'import { Worker } from "node:worker_threads";',
          'import { message } from "@croco/bin-bridge";',
          'if (process.argv.slice(2).join(" ") !== "--controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas") {',
          '  console.error("unexpected command");',
          "  process.exit(1);",
          "}",
          "if (process.env.CROCO_BIN_SMOKE_SENTINEL_CREDENTIAL !== undefined) process.exit(8);",
          'if (!readFileSync("bin-smoke/SmokeController.ts", "utf8").includes("SmokeController")) process.exit(7);',
          "let networkBlocked = false;",
          "try {",
          '  net.connect({ host: "127.0.0.1", port: 9 });',
          "} catch (error) {",
          '  networkBlocked = String(error).includes("package-bin-smoke/network-disabled");',
          "}",
          "if (!networkBlocked) process.exit(6);",
          "let resolverBlocked = false;",
          "try {",
          '  new dns.Resolver().resolve4("example.invalid", () => undefined);',
          "} catch (error) {",
          '  resolverBlocked = String(error).includes("package-bin-smoke/network-disabled");',
          "}",
          "if (!resolverBlocked) process.exit(5);",
          "let promiseResolverBlocked = false;",
          "try {",
          '  new dns.promises.Resolver().resolve4("example.invalid");',
          "} catch (error) {",
          '  promiseResolverBlocked = String(error).includes("package-bin-smoke/network-disabled");',
          "}",
          "if (!promiseResolverBlocked) process.exit(4);",
          "let workerBlocked = false;",
          "try {",
          '  new Worker("", { eval: true });',
          "} catch (error) {",
          '  workerBlocked = String(error).includes("package-bin-smoke/network-disabled");',
          "}",
          "if (!workerBlocked) process.exit(3);",
          "let datagramBlocked = false;",
          "try {",
          '  new dgram.Socket("udp4");',
          "} catch (error) {",
          '  datagramBlocked = String(error).includes("package-bin-smoke/network-disabled");',
          "}",
          "if (!datagramBlocked) process.exit(2);",
          "console.log(`Contract graph check passed for 1 route(s) across 1 controller(s). ${message}`);",
          "",
        ].join("\n"),
      });

      const result = runScript(root);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "package-bin-smoke: @croco/bin-tool croco-openapi-spec --controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas",
      );
      expect(result.stdout).toContain("summary checkedPackages=1 checkedBins=1");
    },
    spawnTimeoutMs,
  );

  it(
    "rejects a packed bin target without a Node shebang",
    () => {
      const root = createTempRoot();
      writeBinPackage(root, {
        script: 'console.log("Usage: smoke-bin");\n',
      });

      const result = runScript(root);

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "@croco/bin-tool: bin smoke-bin is missing the Node shebang",
      );
    },
    spawnTimeoutMs,
  );

  it(
    "reports the package and command when a packed bin fails",
    () => {
      const root = createTempRoot();
      writeBinPackage(root, {
        commandName: "croco-openapi-spec",
        script: [
          "#!/usr/bin/env node",
          'console.error("startup failed");',
          "process.exit(9);",
          "",
        ].join("\n"),
      });

      const result = runScript(root);

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "@croco/bin-tool: croco-openapi-spec --controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas",
      );
      expect(`${result.stdout}\n${result.stderr}`).toContain("startup failed");
    },
    spawnTimeoutMs,
  );

  it(
    "accepts expected nonzero migration diagnostics in packed bin smoke",
    () => {
      const root = createTempRoot();
      writeBinPackage(root, {
        commandName: "migrate",
        script: [
          "#!/usr/bin/env node",
          "const args = process.argv.slice(2);",
          'if (args.length === 1 && args[0] === "--help") {',
          '  console.log("Drizzle migration runner");',
          "  process.exit(0);",
          "}",
          'if (args.length === 1 && args[0] === "status") {',
          '  console.error("migration-runner/database-url-required");',
          "  process.exit(1);",
          "}",
          'if (args.join(" ") === "down --count abc") {',
          '  console.error("migration-runner/invalid-count");',
          "  process.exit(1);",
          "}",
          'console.error(`unexpected args: ${args.join(" ")}`);',
          "process.exit(9);",
          "",
        ].join("\n"),
      });

      const result = runScript(root);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("package-bin-smoke: @croco/bin-tool migrate status");
      expect(result.stdout).toContain(
        "package-bin-smoke: @croco/bin-tool migrate down --count abc",
      );
    },
    spawnTimeoutMs,
  );

  it(
    "executes explicit functional contracts for create-croco-app, croco, and RPC codegen",
    () => {
      const root = createTempRoot();
      writeBinPackage(root, {
        commandName: "create-croco-app",
        directoryName: "create-croco-app",
        packageName: "create-croco-app",
        script: [
          "#!/usr/bin/env node",
          'import { mkdirSync, writeFileSync } from "node:fs";',
          'const args = process.argv.slice(2).join(" ");',
          'if (args !== "bin-smoke-app --preset blank --scope @croco-smoke --no-install --no-git --json") process.exit(9);',
          'mkdirSync("bin-smoke-app", { recursive: true });',
          'writeFileSync("bin-smoke-app/package.json", "{}\\n");',
          'console.log(JSON.stringify({ code: "create-croco-app/project-created" }, null, 2));',
          "",
        ].join("\n"),
      });
      writeBinPackage(root, {
        commandName: "croco",
        directoryName: "cli",
        packageName: "@croco/cli",
        script: [
          "#!/usr/bin/env node",
          'const args = process.argv.slice(2).join(" ");',
          'if (args === "doctor --json") {',
          '  console.log(JSON.stringify({ version: "croco.doctor.v1" }, null, 2));',
          "  process.exit(0);",
          "}",
          'if (args === "migrate up --help") {',
          '  console.log("--cwd=<path>\\n--dir=<path>\\n--dryRun");',
          "  process.exit(0);",
          "}",
          'if (args === "--cwd bin-smoke/migration-workspace --dryRun migrate up -d -migrations --target -1 --connection postgres://db --dry-run") {',
          '  console.log("croco-migrate-wrapper-contract-ok");',
          "  process.exit(0);",
          "}",
          'if (args === "--overwrite migrate up") {',
          '  console.error("Unknown option: --overwrite");',
          "  process.exit(1);",
          "}",
          'if (args === "--cwd migrate --bogus up") {',
          '  console.error("Unknown option: --bogus");',
          "  process.exit(1);",
          "}",
          "process.exit(9);",
          "",
        ].join("\n"),
      });
      writeBinPackage(root, {
        commandName: "croco-rpc-codegen",
        directoryName: "rpc-codegen",
        packageName: "@croco/rpc-codegen",
        script: [
          "#!/usr/bin/env node",
          'import { readFileSync } from "node:fs";',
          'if (process.argv.slice(2).join(" ") !== "--controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas") process.exit(9);',
          "if (process.env.CROCO_BIN_SMOKE_SENTINEL_CREDENTIAL !== undefined) process.exit(8);",
          'if (!readFileSync("bin-smoke/SmokeController.ts", "utf8").includes("SmokeController")) process.exit(7);',
          'console.log("Contract graph check passed for 1 route(s) across 1 controller(s).");',
          "",
        ].join("\n"),
      });

      const result = runScript(root);

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain(
        "package-bin-smoke: create-croco-app create-croco-app bin-smoke-app --preset blank --scope @croco-smoke --no-install --no-git --json",
      );
      expect(result.stdout).toContain("package-bin-smoke: @croco/cli croco doctor --json");
      expect(result.stdout).toContain(
        "package-bin-smoke: @croco/cli croco --cwd bin-smoke/migration-workspace --dryRun migrate up -d -migrations --target -1 --connection postgres://db --dry-run",
      );
      expect(result.stdout).toContain(
        "package-bin-smoke: @croco/rpc-codegen croco-rpc-codegen --controllers bin-smoke/SmokeController.ts --tsconfig bin-smoke/tsconfig.json --check --compatibility-problems --compatibility-schemas",
      );
      expect(result.stdout).toContain("summary checkedPackages=3 checkedBins=3");
    },
    spawnTimeoutMs,
  );

  it(
    "rejects a published bin without an explicit functional smoke contract",
    () => {
      const root = createTempRoot();
      writeBinPackage(root, {
        script: ["#!/usr/bin/env node", 'console.log("help-only shim");', ""].join("\n"),
      });

      const result = runScript(root);

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "@croco/bin-tool: bin smoke-bin is missing a functional smoke command contract",
      );
    },
    spawnTimeoutMs,
  );

  it("rejects a package fixture path outside the disposable smoke root", () => {
    const root = createTempRoot();
    const packageSmokeRoot = join(root, "consumer");
    const externalPath = join(root, "external-cli.js");
    mkdirSync(packageSmokeRoot);
    writeFileSync(externalPath, "original\n");

    expect(() => replaceInstalledPackageFile(packageSmokeRoot, externalPath, "stub\n")).toThrow(
      "package-bin-smoke/fixture-path-escaped",
    );
    expect(readFileSync(externalPath, "utf8")).toBe("original\n");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-package-bin-smoke-test-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"));
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "package-bin-smoke-workspace",
        packageManager: "pnpm@11.9.0",
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

  return root;
}

function writeHelperPackage(root: string): void {
  const packageDir = join(root, "packages", "bin-helper");
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(join(packageDir, "dist", "index.js"), 'export const message = "helper-ok";\n');
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@croco/bin-helper",
        version: "0.0.0",
        exports: {
          ".": "./dist/index.js",
        },
        files: ["dist"],
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
}

function writeBridgePackage(root: string): void {
  const packageDir = join(root, "packages", "bin-bridge");
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(
    join(packageDir, "dist", "index.js"),
    'export { message } from "@croco/bin-helper";\n',
  );
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@croco/bin-bridge",
        version: "0.0.0",
        exports: {
          ".": "./dist/index.js",
        },
        files: ["dist"],
        peerDependencies: {
          "@croco/bin-helper": "0.0.0",
        },
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
}

function writeBinPackage(
  root: string,
  options: {
    readonly commandName?: string;
    readonly dependencies?: Record<string, string>;
    readonly directoryName?: string;
    readonly packageName?: string;
    readonly script: string;
  },
): void {
  const packageDir = join(root, "packages", options.directoryName ?? "bin-tool");
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(join(packageDir, "dist", "cli.js"), options.script);
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: options.packageName ?? "@croco/bin-tool",
        version: "0.0.0",
        bin: {
          [options.commandName ?? "smoke-bin"]: "./dist/cli.js",
        },
        dependencies: options.dependencies,
        files: ["dist"],
        type: "module",
      },
      null,
      2,
    )}\n`,
  );
}

function runScript(root: string): ScriptResult {
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath, "--root", root], {
    encoding: "utf-8",
    env: { ...process.env, CROCO_BIN_SMOKE_SENTINEL_CREDENTIAL: "must-not-reach-bin" },
    timeout: spawnTimeoutMs,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
