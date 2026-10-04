import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { createCrocoCommandRuntime, runWithCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { generateController } from "../commands/makeController.js";

describe("generateController", () => {
  it.each(["api", "server", "backend"])("should generate in detected apps/%s", async (app) => {
    const cwd = await createWorkspace();
    await fs.rename(path.join(cwd, "apps", "api-server"), path.join(cwd, "apps", app));
    const result = await generateController("User", { cwd });
    const target = path.join(cwd, "apps", app, "src", "controllers", "UserController.ts");
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
      generateController("User", { cwd }),
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
      await expect(generateController("User", { cwd })).rejects.toThrow(
        `Missing dependencies in apps/${app}/package.json`,
      );
      await expect(
        fs.access(path.join(cwd, "apps", app, "src", "controllers", "UserController.ts")),
      ).rejects.toThrow();
    },
  );
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
    expect(content).toContain("import { Controller, Ctx, Get, Post, Put, Delete }");
    expect(content).toContain('import type { CrocoHttpContext } from "@croco/transports-http";');
    expect(content).toContain("async create(@Ctx() ctx: CrocoHttpContext): Promise<unknown>");
    expect(content).not.toContain("RouteContext");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateController("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should reject missing generated import dependencies before writing files", async () => {
    const cwd = await createWorkspace({ apiServerManifest: "{}" });
    const filePath = path.join(
      cwd,
      "apps",
      "api-server",
      "src",
      "controllers",
      "UserProfileController.ts",
    );

    await expect(generateController("UserProfile", { cwd })).rejects.toThrow(
      "Missing dependencies in apps/api-server/package.json for generated imports: @croco/protocols-rest, @croco/transports-http.",
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
      "controllers",
      "DryRunController.ts",
    );

    const result = await generateController("DryRun", { cwd, dryRun: true });

    expect(result?.status).toBe("skipped-dry-run");
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});

async function createWorkspace(options: { apiServerManifest?: string } = {}): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-controller-"));

  await fs.mkdir(path.join(cwd, "apps", "api-server"), { recursive: true });
  await fs.writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages: []\n");
  await fs.writeFile(
    path.join(cwd, "apps", "api-server", "package.json"),
    options.apiServerManifest ??
      apiServerManifest(["@croco/protocols-rest", "@croco/transports-http"]),
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
