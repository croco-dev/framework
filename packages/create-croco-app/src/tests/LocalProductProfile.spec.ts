import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("local Next.js tRPC product profile", () => {
  it("generates one executable profile with explicit storage and local authentication boundaries", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-product-profile-"));
    directories.push(root);
    const project = join(root, "app");
    await generate(
      project,
      normalizeNonInteractiveOptions({
        projectName: "app",
        scope: "@local",
        preset: "ddd-fullstack",
        api: "trpc",
        apiHosting: "nextjs",
        webApps: ["web"],
        installDeps: false,
        initGit: false,
      }),
      { outputMode: "json" },
    );
    const web = join(project, "apps/web");
    const manifest = JSON.parse(readFileSync(join(web, "croco.product-profile.json"), "utf8"));
    expect(manifest.runtime).toBe("node+browser");
    expect(manifest.client).toBe("typed-trpc-native-tanstack-query");
    expect(manifest.authentication.default).toBe("disabled");
    expect(manifest.persistence.scope).toBe("single-process-local");
    expect(manifest.unsupported).toContain("warehouse-data-addon");
    for (const source of [
      manifest.compositionRoot,
      manifest.domain,
      manifest.authentication.provider,
      "scripts/migrate-product.ts",
      "src/app/products/[id]/page.tsx",
      "src/app/results/[id]/page.tsx",
      "src/server/tests/ProductTrials.spec.ts",
    ]) {
      expect(existsSync(join(web, source)), source).toBe(true);
    }
    const pkg = JSON.parse(readFileSync(join(web, "package.json"), "utf8"));
    expect(pkg.scripts.migrate).toBe("tsx scripts/migrate-product.ts");
    expect(pkg.scripts.build).toContain("di:generate");
    expect(pkg.scripts["start:demo"]).toContain("--hostname 127.0.0.1");
    for (const dep of [
      "@croco/auth-core",
      "@croco/framework-module",
      "@croco/tx-core",
      "@croco/events-inmemory",
    ]) {
      expect(pkg.dependencies[dep], dep).toBeDefined();
      expect(pkg.dependencies[dep]).not.toBe("workspace:*");
    }
    expect(readFileSync(join(project, "README.md"), "utf8")).toContain("apps/web/README.md");
    expect(readFileSync(join(web, "README.md"), "utf8")).toContain("not an outbox relay");
    expect(readFileSync(join(web, ".gitignore"), "utf8")).toContain(".local/");
  });
});
