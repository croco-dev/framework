import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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

  it(
    "installs packed bins with transitive internal peer tarball overrides",
    () => {
      const root = createTempRoot();
      writeHelperPackage(root);
      writeBridgePackage(root);
      writeBinPackage(root, {
        dependencies: {
          "@croco/bin-bridge": "0.0.0",
        },
        script: [
          "#!/usr/bin/env node",
          'import { message } from "@croco/bin-bridge";',
          'if (!process.argv.includes("--help")) {',
          '  console.error("expected --help");',
          "  process.exit(1);",
          "}",
          "console.log(`Usage: smoke-bin ${message}`);",
          "",
        ].join("\n"),
      });

      const result = runScript(root);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("package-bin-smoke: @croco/bin-tool smoke-bin --help");
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
        "@croco/bin-tool: pnpm exec smoke-bin --help",
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
      expect(result.stdout).toContain("package-bin-smoke: @croco/bin-tool migrate --help");
      expect(result.stdout).toContain("package-bin-smoke: @croco/bin-tool migrate status");
      expect(result.stdout).toContain(
        "package-bin-smoke: @croco/bin-tool migrate down --count abc",
      );
    },
    spawnTimeoutMs,
  );
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
        packageManager: "pnpm@10.15.1",
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
    readonly script: string;
  },
): void {
  const packageDir = join(root, "packages", "bin-tool");
  mkdirSync(join(packageDir, "dist"), { recursive: true });
  writeFileSync(join(packageDir, "dist", "cli.js"), options.script);
  writeFileSync(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: "@croco/bin-tool",
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
    timeout: spawnTimeoutMs,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
