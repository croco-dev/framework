import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Project, ts } from "ts-morph";
import { describe, expect, it } from "vitest";
import { createCrocoCommandRuntime, runWithCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { generateEvent } from "../commands/makeEvent.js";
import { generateListener } from "../commands/makeListener.js";

describe("generateEvent", () => {
  it.each(["api", "server", "backend"])("should generate in detected apps/%s", async (app) => {
    const cwd = await createWorkspace();
    await fs.rename(path.join(cwd, "apps", "api-server"), path.join(cwd, "apps", app));
    const result = await generateEvent("User", { cwd });
    const target = path.join(cwd, "apps", app, "src", "events", "UserEvent.ts");
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
    const result = await runWithCrocoCommandRuntime(runtime, () => generateEvent("User", { cwd }));
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
      await expect(generateEvent("User", { cwd })).rejects.toThrow(
        `Missing dependencies in apps/${app}/package.json`,
      );
      await expect(
        fs.access(path.join(cwd, "apps", app, "src", "events", "UserEvent.ts")),
      ).rejects.toThrow();
    },
  );
  it("should create an event file", async () => {
    const cwd = await createWorkspace();

    const result = await generateEvent("UserProfile", { cwd });
    const filePath = path.join(cwd, "apps", "api-server", "src", "events", "UserProfileEvent.ts");
    const content = await fs.readFile(filePath, "utf-8");

    expect(result?.status).toBe("created");
    expect(result?.path).toBe(filePath);
    expect(content).toContain('import { DomainEvent } from "@croco/events-core";');
    expect(content).toContain("export class UserProfileEvent extends DomainEvent {");
    expect(content).toContain('static eventName = "user-profile";');
    expect(content).toContain("constructor(public readonly payload: { [key: string]: unknown })");
  });

  it("should throw for invalid names", async () => {
    const cwd = await createWorkspace();

    await expect(generateEvent("123User", { cwd })).rejects.toThrow("Invalid name: 123User");
  });

  it("should generate an event and component listener that typecheck", async () => {
    const cwd = await createWorkspace();

    try {
      const event = await generateEvent("Foo", { cwd });
      const listener = await generateListener("Foo", { cwd });

      expect(event?.status).toBe("created");
      expect(listener?.status).toBe("created");

      const project = new Project({
        compilerOptions: {
          experimentalDecorators: true,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          noEmit: true,
          paths: {
            "@croco/*": [fileURLToPath(new URL("../../../*/src/index.ts", import.meta.url))],
          },
          skipLibCheck: true,
          strict: true,
          strictPropertyInitialization: false,
          target: ts.ScriptTarget.ES2017,
        },
      });
      project.addSourceFilesAtPaths(path.join(cwd, "apps/api-server/src/**/*.ts"));

      const diagnostics = project.getPreEmitDiagnostics();
      expect(project.formatDiagnosticsWithColorAndContext(diagnostics)).toBe("");
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
    }
  }, 30_000);

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
