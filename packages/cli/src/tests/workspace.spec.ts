import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { detect } from "../libs/workspace.js";

describe("detect", () => {
  const rootDir = join("/tmp", "croco-ws-test-" + Date.now());

  beforeEach(async () => {
    try {
      await rm(rootDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    await mkdir(join(rootDir, "apps", "api-server"), { recursive: true });
    await mkdir(join(rootDir, "apps", "console-web"), { recursive: true });
    await writeFile(join(rootDir, "pnpm-workspace.yaml"), "");
    await writeFile(join(rootDir, "apps", "api-server", "package.json"), "{}");
    await writeFile(join(rootDir, "apps", "console-web", "package.json"), "{}");
  });

  it("should find workspace root from nested directory", async () => {
    const result = await detect(join(rootDir, "apps", "api-server", "src"));
    expect(result.root).toBe(rootDir);
    expect(result.hasApiServer).toBe(true);
    expect(result.hasConsoleWeb).toBe(true);
  });

  it.each(["api-server", "api", "server", "backend"])("should detect apps/%s", async (app) => {
    await rm(join(rootDir, "apps", "api-server"), { recursive: true, force: true });
    await mkdir(join(rootDir, "apps", app), { recursive: true });
    await writeFile(join(rootDir, "apps", app, "package.json"), "{}");

    const result = await detect(join(rootDir, "apps", app, "src"));
    expect(result.root).toBe(rootDir);
    expect(result.hasApiServer).toBe(true);
    expect(result.apiServerDir).toBe(`apps/${app}`);
  });

  it("should prefer api-server when multiple candidates exist", async () => {
    for (const app of ["api", "server", "backend"]) {
      await mkdir(join(rootDir, "apps", app), { recursive: true });
      await writeFile(join(rootDir, "apps", app, "package.json"), "{}");
    }
    expect((await detect(rootDir)).apiServerDir).toBe("apps/api-server");
  });

  it("should require a package manifest and preserve candidate priority", async () => {
    await rm(join(rootDir, "apps", "api-server", "package.json"));
    for (const app of ["api", "server", "backend"]) {
      await mkdir(join(rootDir, "apps", app), { recursive: true });
      await writeFile(join(rootDir, "apps", app, "package.json"), "{}");
    }
    expect((await detect(rootDir)).apiServerDir).toBe("apps/api");
    await rm(join(rootDir, "apps", "api", "package.json"));
    expect((await detect(rootDir)).apiServerDir).toBe("apps/server");
  });

  it("should preserve a detected root when no API app exists", async () => {
    await rm(join(rootDir, "apps", "api-server"), { recursive: true, force: true });
    expect(await detect(rootDir)).toEqual({
      root: rootDir,
      hasApiServer: false,
      apiServerDir: null,
      hasConsoleWeb: true,
    });
  });

  it("should return root=null when no workspace.yaml found", async () => {
    await rm(join(rootDir, "pnpm-workspace.yaml"));
    const result = await detect(join(rootDir, "apps", "api-server", "src"));
    expect(result.root).toBe(null);
    expect(result.apiServerDir).toBe(null);
    expect(result.hasApiServer).toBe(false);
    expect(result.hasConsoleWeb).toBe(false);
  });

  it("should detect api-server when only api-server exists", async () => {
    await rm(join(rootDir, "apps", "console-web"), { recursive: true, force: true });
    const result = await detect(rootDir);
    expect(result.root).toBe(rootDir);
    expect(result.hasApiServer).toBe(true);
    expect(result.hasConsoleWeb).toBe(false);
  });
});
