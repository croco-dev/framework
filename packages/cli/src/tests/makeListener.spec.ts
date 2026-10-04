import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrocoCommandRuntime, runWithCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { generateListener } from "../commands/makeListener.js";

describe("generateListener", () => {
  it.each(["api", "server", "backend"])("should generate in detected apps/%s", async (app) => {
    const cwd = await createWorkspace();
    await fs.rename(path.join(cwd, "apps", "api-server"), path.join(cwd, "apps", app));
    const result = await generateListener("User", { cwd });
    const target = path.join(cwd, "apps", app, "src", "listeners", "UserListener.ts");
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
    const result = await runWithCrocoCommandRuntime(runtime, () =>
      generateListener("User", { cwd }),
    );
    expect(result).toBeNull();
    expect(messages).toEqual([
      "No API server app detected in apps/ (checked api-server, api, server, backend).",
    ]);
    await expect(fs.access(path.join(cwd, "apps", "api-server"))).rejects.toThrow();
  });

  it.each(["api", "server", "backend"])(
    "should validate the detected apps/%s manifest before writing",
    async (app) => {
      const cwd = await createWorkspace({ apiServerManifest: "{}" });
      await fs.rename(path.join(cwd, "apps", "api-server"), path.join(cwd, "apps", app));
      await expect(generateListener("User", { cwd })).rejects.toThrow(
        `Missing dependencies in apps/${app}/package.json`,
      );
      await expect(
        fs.access(path.join(cwd, "apps", app, "src", "listeners", "UserListener.ts")),
      ).rejects.toThrow();
    },
  );
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
    expect(content).toContain('import { Component } from "@croco/framework-context";');
    expect(content).toContain('import { UserProfileEvent } from "../events/UserProfileEvent";');
    expect(content).toContain("@Component()\n@RegisterEventHandler(UserProfileEvent)");
    expect(content).toContain(
      "export class UserProfileListener implements EventHandler<UserProfileEvent>",
    );
    expect(content).toContain("handle(event: UserProfileEvent): void");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateListener("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should reject missing generated import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "listeners",
      "UserProfileListener.ts",
    );

    await expect(generateListener("UserProfile", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/events-core, @croco/framework-context.",
    );
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("should require framework-context before writing a listener", async () => {
    const cwd = await createWorkspace({
      apiServerManifest: apiServerManifest(["@croco/events-core"]),
    });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "listeners",
      "UserProfileListener.ts",
    );

    await expect(generateListener("UserProfile", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/framework-context.",
    );
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  it("should not write files in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const filePath = path.join(cwd, "apps", "api-server", "src", "listeners", "DryRunListener.ts");

    const result = await generateListener("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(options: { apiServerManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-listener-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ??
      apiServerManifest(["@croco/events-core", "@croco/framework-context"]),
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
