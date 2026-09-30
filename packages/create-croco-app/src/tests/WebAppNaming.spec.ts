import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";
import type { GeneratorOptions, NormalizedGeneratorOptions } from "../types.js";

const roots: string[] = [];

function createTarget(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-web-app-names-"));
  roots.push(root);
  return join(root, "app");
}

function fullstackOptions(options: NormalizedGeneratorOptions): GeneratorOptions {
  return normalizeNonInteractiveOptions({
    projectName: "app",
    scope: "@acme",
    preset: "ddd-fullstack",
    apiHosting: "standalone",
    webApps: ["web", "admin"],
    installDeps: false,
    initGit: false,
    agentRules: false,
    ...options,
  });
}

async function generateFullstack(options: NormalizedGeneratorOptions): Promise<string> {
  const targetDir = createTarget();
  await generate(targetDir, fullstackOptions(options), { outputMode: "json" });
  return targetDir;
}

function readPackageName(targetDir: string, app: string): string {
  return (
    JSON.parse(readFileSync(join(targetDir, "apps", app, "package.json"), "utf8")) as {
      name: string;
    }
  ).name;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe.each(["graphql", "trpc"] as const)("%s web app naming", (api) => {
  it.each(["opennext", "vercel", "docker", "vite-spa", "cloudflare-meta-vite"] as const)(
    "uses each app name for the %s workspace package",
    async (frontendDeploy) => {
      const targetDir = await generateFullstack({ api, frontendDeploy });
      expect([readPackageName(targetDir, "web"), readPackageName(targetDir, "admin")]).toEqual([
        "@acme/web",
        "@acme/admin",
      ]);
    },
  );

  it.each(["opennext", "cloudflare-meta-vite"] as const)(
    "uses distinct app names for %s Workers",
    async (frontendDeploy) => {
      const targetDir = await generateFullstack({ api, frontendDeploy });
      const names = ["web", "admin"].map(
        (app) =>
          /^name = "(.+)"$/m.exec(
            readFileSync(join(targetDir, "apps", app, "wrangler.toml"), "utf8"),
          )?.[1],
      );
      expect(names).toEqual(["app-web", "app-admin"]);
    },
  );

  it("prunes each Docker app's actual workspace package", async () => {
    const targetDir = await generateFullstack({ api, frontendDeploy: "docker" });
    for (const app of ["web", "admin"]) {
      const dockerfile = readFileSync(join(targetDir, app, "Dockerfile"), "utf8");
      expect(/turbo prune (\S+)/.exec(dockerfile)?.[1]).toBe(readPackageName(targetDir, app));
    }
  });

  it("deploys the named Vite app's generated build output", async () => {
    const targetDir = await generateFullstack({ api, frontendDeploy: "vite-spa" });
    const stack = readFileSync(join(targetDir, "apps/admin/stacks/MyStack.ts"), "utf8");
    expect(/output:\s*"([^"]+)"/.exec(stack)?.[1]).toBe("apps/admin/dist");
  });

  it("builds each Vercel app's actual workspace package", async () => {
    const targetDir = await generateFullstack({ api, frontendDeploy: "vercel" });
    for (const app of ["web", "admin"]) {
      const config = JSON.parse(
        readFileSync(join(targetDir, "apps", app, "vercel.json"), "utf8"),
      ) as { buildCommand: string };
      expect(/--filter=(\S+)/.exec(config.buildCommand)?.[1]).toBe(readPackageName(targetDir, app));
    }
  });

  it("builds each Docker app's actual workspace package", async () => {
    const targetDir = await generateFullstack({ api, frontendDeploy: "docker" });
    for (const app of ["web", "admin"]) {
      const dockerfile = readFileSync(join(targetDir, app, "Dockerfile"), "utf8");
      expect(/pnpm turbo build --filter=(\S+)/.exec(dockerfile)?.[1]).toBe(
        readPackageName(targetDir, app),
      );
    }
  });

  it.each(["opennext", "vercel"] as const)(
    "keeps the backend Docker recipe's web runner paths with %s frontend deploy",
    async (frontendDeploy) => {
      const targetDir = await generateFullstack({ api, backendDeploy: "docker", frontendDeploy });
      const dockerfile = readFileSync(join(targetDir, "web/Dockerfile"), "utf8");

      expect(/turbo prune (\S+)/.exec(dockerfile)?.[1]).toBe(readPackageName(targetDir, "web"));
      expect(/pnpm turbo build --filter=(\S+)/.exec(dockerfile)?.[1]).toBe(
        readPackageName(targetDir, "web"),
      );
      expect(dockerfile.match(/apps\/[^\s"/]+/g)).toEqual(Array(6).fill("apps/web"));
    },
  );

  it.each(["web", "admin"])("runs Docker from the generated %s app directory", async (app) => {
    const targetDir = await generateFullstack({ api, frontendDeploy: "docker" });
    const dockerfile = readFileSync(join(targetDir, app, "Dockerfile"), "utf8");
    const runnerPaths = dockerfile.match(/apps\/[^\s"/]+/g);
    expect(runnerPaths).toEqual(Array(6).fill(`apps/${app}`));
  });

  it("rejects a non-web app name when normalizing nextjs hosting", () => {
    expect(() =>
      fullstackOptions({ api, apiHosting: "nextjs", webApps: ["admin"], frontendDeploy: "docker" }),
    ).toThrow(
      expect.objectContaining({
        code: "create-croco-app/invalid-cli-option",
        extensions: expect.objectContaining({ option: "--web-apps" }),
      }),
    );
  });

  it("rejects a non-web nextjs app before creating the destination", async () => {
    const targetDir = createTarget();
    const options = fullstackOptions({ api, apiHosting: "nextjs", webApps: ["web"] });
    options.webApps = ["admin"];
    await expect(generate(targetDir, options, { outputMode: "json" })).rejects.toMatchObject({
      code: "create-croco-app/invalid-cli-option",
      extensions: { option: "--web-apps" },
    });
    expect(existsSync(targetDir)).toBe(false);
  });
});
