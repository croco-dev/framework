import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const packageName = "@croco/framework-context";
const packageDir = join(rootDir, "packages", "framework-context");
const distDir = join(packageDir, "dist");
const sourceManifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf-8"));
const smokeRoot = mkdtempSync(join(tmpdir(), "croco-entrypoint-smoke-"));
const spawnTimeoutMs = 30_000;

try {
  const smokePackageDir = join(smokeRoot, "node_modules", "@croco", "framework-context");
  mkdirSync(smokePackageDir, { recursive: true });
  symlinkSync(distDir, join(smokePackageDir, "dist"), "dir");

  const publishManifest = {
    ...sourceManifest,
    ...sourceManifest.publishConfig,
  };
  delete publishManifest.publishConfig;

  writeFileSync(
    join(smokePackageDir, "package.json"),
    `${JSON.stringify(publishManifest, null, 2)}\n`,
  );
  writeFileSync(
    join(smokeRoot, "cjs.cjs"),
    [
      `const pkg = require("${packageName}");`,
      "if (!pkg.Container || !pkg.Context) {",
      '  throw new Error("CommonJS package entrypoint did not expose framework-context exports");',
      "}",
      'console.log("cjs ok");',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(smokeRoot, "esm.mjs"),
    [
      `const pkg = await import("${packageName}");`,
      "if (!pkg.Container || !pkg.Context) {",
      '  throw new Error("ESM package entrypoint did not expose framework-context exports");',
      "}",
      'console.log("esm ok");',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(smokeRoot, "types.ts"),
    [
      `import { Container, Token } from "${packageName}";`,
      "",
      "const token = new Token<string>('smoke');",
      "Container.set(token, 'ok');",
      "const value: string = Container.get(token);",
      "void value;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(smokeRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
        },
        include: ["types.ts"],
      },
      null,
      2,
    ) + "\n",
  );

  run("node", [join(smokeRoot, "cjs.cjs")], smokeRoot);
  run("node", [join(smokeRoot, "esm.mjs")], smokeRoot);
  run(tscPath(), ["-p", join(smokeRoot, "tsconfig.json")], smokeRoot);

  console.log("package-entrypoint-smoke: cjs, esm, and typescript consumers resolved");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function tscPath(): string {
  const executable = process.platform === "win32" ? "tsc.cmd" : "tsc";
  return join(rootDir, "node_modules", ".bin", executable);
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}
