import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SmokeCase = {
  readonly name: string;
  readonly args: readonly string[];
  readonly validation: readonly string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const cliPath = join(rootDir, "packages", "create-croco-app", "dist", "index.js");
const smokeRoot = mkdtempSync(join(tmpdir(), "croco-generated-app-smoke-"));
const commandTimeoutMs = 600_000;

const smokeCases: readonly SmokeCase[] = [
  {
    name: "graphql-lambda-api",
    args: [
      "--preset",
      "ddd-api",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--backend-deploy",
      "lambda",
      "--db",
      "mongodb",
      "--no-git",
    ],
    validation: ["build"],
  },
  {
    name: "trpc-nextjs-fullstack",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "trpc",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--no-git",
    ],
    validation: ["build"],
  },
];

try {
  run("pnpm", ["build", "--filter=create-croco-app...", "--force"], rootDir);
  assertExists(cliPath, "create-croco-app dist CLI is missing after build");

  for (const smokeCase of smokeCases) {
    const projectDir = join(smokeRoot, smokeCase.name);

    run("node", [cliPath, projectDir, ...smokeCase.args], rootDir);
    assertExists(join(projectDir, "pnpm-lock.yaml"), `${smokeCase.name} did not create a lockfile`);
    assertExists(
      join(projectDir, "node_modules"),
      `${smokeCase.name} did not install dependencies`,
    );
    run("pnpm", ["--dir", projectDir, ...smokeCase.validation], rootDir);

    console.log(`create-croco-app-generated-smoke: ${smokeCase.name} installed and built`);
  }

  console.log("create-croco-app-generated-smoke: all generated app smoke cases passed");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function assertExists(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, [...args], {
    cwd,
    stdio: "inherit",
    timeout: commandTimeoutMs,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}
