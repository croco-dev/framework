import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { generateController } from "../commands/makeController.js";

describe("generateController", () => {
  it("should create a controller file", async () => {
    const cwd = await createWorkspace();

    const result = await generateController("UserProfile", { cwd });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "controllers",
      "UserProfileController.ts",
    );
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).toContain('@Controller("/user-profile")');
    expect(content).toContain("export class UserProfileController");
    expect(content).toContain('@Post("/")');
    expect(content).toContain('@Get("/")');
    expect(content).toContain('@Get("/:id")');
    expect(content).toContain('@Put("/:id")');
    expect(content).toContain('@Delete("/:id")');
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateController("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "controllers",
      "DryRunController.ts",
    );

    const result = await generateController("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-controller-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(path.join(cwd, "apps", "api-server", "package.json"), "{}");

  return cwd;
}
