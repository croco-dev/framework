import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { generateListener } from "../commands/makeListener.js";

describe("generateListener", () => {
  it("should create a listener file", async () => {
    const cwd = await createWorkspace();

    const result = await generateListener("UserProfile", { cwd });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "listeners",
      "UserProfileListener.ts",
    );
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).toContain('import { RegisterEventHandler } from "@croco/events-core";');
    expect(content).toContain('import type { EventHandler } from "@croco/events-core";');
    expect(content).toContain(
      'import type { UserProfileEvent } from "../events/UserProfileEvent";',
    );
    expect(content).toContain("@RegisterEventHandler(UserProfileEvent)");
    expect(content).toContain(
      "export class UserProfileListener implements EventHandler<UserProfileEvent>",
    );
    expect(content).toContain("handle(event: UserProfileEvent): void");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateListener("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(cwd, "apps", "api-server", "src", "listeners", "DryRunListener.ts");

    const result = await generateListener("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-listener-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(path.join(cwd, "apps", "api-server", "package.json"), "{}");

  return cwd;
}
