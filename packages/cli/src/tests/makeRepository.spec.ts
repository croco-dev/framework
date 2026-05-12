import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { generateRepository } from "../commands/makeRepository.js";

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
    expect(content).toContain('import { Repository } from "@croco/repository-core";');
    expect(content).toContain(
      'import type { UserProfileEntity } from "../entities/UserProfileEntity";',
    );
    expect(content).toContain(
      "export class UserProfileRepository extends Repository<UserProfileEntity, string> {}",
    );
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateRepository("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
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

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-repository-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(path.join(cwd, "apps", "api-server", "package.json"), "{}");

  return cwd;
}
