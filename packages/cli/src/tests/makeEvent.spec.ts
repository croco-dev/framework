import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { generateEvent } from "../commands/makeEvent.js";

describe("generateEvent", () => {
  it("should create an event file", async () => {
    const cwd = await createWorkspace();

    const result = await generateEvent("UserProfile", { cwd });
    const filePath = path.join(cwd, "apps", "api-server", "src", "events", "UserProfileEvent.ts");
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).toContain('import { DomainEvent } from "@croco/events-core";');
    expect(content).toContain(
      "export class UserProfileEvent extends DomainEvent<{ payload: { [key: string]: unknown } }>",
    );
    expect(content).toContain('static eventName = "user-profile";');
    expect(content).toContain("constructor(public readonly payload: { [key: string]: unknown })");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateEvent("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should reject missing generated import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });
    const filePath = path.join(cwd, "apps", "api-server", "src", "events", "UserProfileEvent.ts");

    await expect(generateEvent("UserProfile", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/events-core.",
    );
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(cwd, "apps", "api-server", "src", "events", "DryRunEvent.ts");

    const result = await generateEvent("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(options: { apiServerManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-event-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ?? apiServerManifest(["@croco/events-core"]),
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
