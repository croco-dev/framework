import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { generateEntity } from "../commands/makeEntity.js";
import { generateRepository } from "../commands/makeRepository.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

describe("generateRepository", () => {
  it("should create a repository file", async () => {
    const cwd = await createWorkspace();

    const result = await generateRepository("UserProfile", { cwd });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "repositories",
      "UserProfileRepository.ts",
    );
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).toContain('import type { Repository } from "@croco/repository-core";');
    expect(content).toContain(
      'import type { UserProfileEntity } from "../entities/UserProfileEntity";',
    );
    expect(content).toContain(
      "export class UserProfileRepository implements Repository<UserProfileEntity, string>",
    );
    expect(content).toContain("async findById(id: string): Promise<UserProfileEntity | null>");
    expect(content).toContain(
      "async findByIds(ids: readonly string[]): Promise<ReadonlyArray<UserProfileEntity>>",
    );
    expect(content).toContain("async save(entity: UserProfileEntity): Promise<UserProfileEntity>");
    expect(content).toContain("async deleteById(id: string): Promise<void>");
    expect(content).not.toContain("extends Repository");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateRepository("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should generate repository and entity code that typechecks against repository-core", async () => {
    const cwd = await createWorkspace();

    await generateEntity("UserProfile", { cwd });
    await generateRepository("UserProfile", { cwd });

    const tsconfigPath = path.join(cwd, "tsconfig.generated.json");
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            module: "ESNext",
            moduleResolution: "Bundler",
            noEmit: true,
            paths: {
              "@croco/repository-core": [
                path.join(
                  path.relative(cwd, REPO_ROOT),
                  "packages/repository-core/src/libs/Repository.ts",
                ),
              ],
            },
            skipLibCheck: true,
            strict: true,
            target: "ES2017",
          },
          include: [
            "apps/api-server/src/entities/**/*.ts",
            "apps/api-server/src/repositories/**/*.ts",
          ],
        },
        null,
        2,
      ),
    );

    await expectGeneratedFixtureToTypecheck(tsconfigPath);
  });

  it("should reject missing generated import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "repositories",
      "UserProfileRepository.ts",
    );

    await expect(generateRepository("UserProfile", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/repository-core.",
    );
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "repositories",
      "DryRunRepository.ts",
    );

    const result = await generateRepository("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function expectGeneratedFixtureToTypecheck(tsconfigPath: string): Promise<void> {
  try {
    await execFileAsync("pnpm", ["exec", "tsc", "-p", tsconfigPath, "--noEmit"], {
      cwd: REPO_ROOT,
    });
  } catch (error) {
    const output = getExecOutput(error);
    throw new Error(`Generated fixture failed to typecheck.\n${output}`);
  }
}

function getExecOutput(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const { message, stdout, stderr } = error as {
      message?: string;
      stdout?: string;
      stderr?: string;
    };
    return [message, stdout, stderr].filter(Boolean).join("\n");
  }

  return String(error);
}

async function createWorkspace(options: { apiServerManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-repository-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ?? apiServerManifest(["@croco/repository-core"]),
  );

  return cwd;
}

function apiServerManifest(packageNames: readonly string[]): string {
  return JSON.stringify(
    {
      dependencies: Object.fromEntries(
        packageNames.map((packageName) => [packageName, "workspace:*"]),
      ),
    },
    null,
    2,
  );
}
