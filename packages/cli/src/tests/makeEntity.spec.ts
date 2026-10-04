import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrocoCommandRuntime, runWithCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { generateEntity } from "../commands/makeEntity.js";

describe("generateEntity", () => {
  it.each(["api", "server", "backend"])("should generate in detected apps/%s", async (app) => {
    const cwd = await createWorkspace();
    await fs.rename(path.join(cwd, "apps", "api-server"), path.join(cwd, "apps", app));
    const result = await generateEntity("User", { cwd });
    const target = path.join(cwd, "apps", app, "src", "entities", "UserEntity.ts");
    expect(result?.status).toBe("created");
    expect(result?.path).toBe(target);
    await expect(fs.access(target)).resolves.toBeUndefined();
    await expect(fs.access(path.join(cwd, "apps", "api-server"))).rejects.toThrow();
  });

  it("should distinguish a workspace without an API app", async () => {
    const cwd = await createWorkspace();
    await fs.rm(path.join(cwd, "apps", "api-server"), { recursive: true });
    const messages: string[] = [];
    const runtime = createCrocoCommandRuntime({ stdout: (message) => messages.push(message) });
    const result = await runWithCrocoCommandRuntime(runtime, () => generateEntity("User", { cwd }));
    expect(result).toBeNull();
    expect(messages).toEqual([
      "No API server app detected in apps/ (checked api-server, api, server, backend).",
    ]);
    await expect(fs.access(path.join(cwd, "apps", "api-server"))).rejects.toThrow();
  });
  it("should create an entity file", async () => {
    const cwd = await createWorkspace();

    const result = await generateEntity("UserProfile", { cwd });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "entities",
      "UserProfileEntity.ts",
    );
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).not.toContain("@croco/repository-core");
    expect(content).not.toContain("@Entity()");
    expect(content).toContain("export class UserProfileEntity");
    expect(content).toContain("id!: string;");
    expect(content).toContain("createdAt!: Date;");
    expect(content).toContain("updatedAt!: Date;");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateEntity("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(cwd, "apps", "api-server", "src", "entities", "DryRunEntity.ts");

    const result = await generateEntity("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-entity-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(path.join(cwd, "apps", "api-server", "package.json"), "{}");

  return cwd;
}
