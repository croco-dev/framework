import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function generateStandaloneNextWeb(api: "graphql" | "trpc"): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "croco-standalone-next-"));
  roots.push(root);
  const targetDir = join(root, "app");
  await generate(
    targetDir,
    normalizeNonInteractiveOptions({
      projectName: "app",
      scope: "@acme",
      preset: "ddd-fullstack",
      api,
      apiHosting: "standalone",
      webApps: ["web"],
      backendDeploy: "lambda",
      frontendDeploy: "opennext",
      installDeps: false,
      initGit: false,
    }),
    { outputMode: "json" },
  );
  return targetDir;
}

describe.each(["graphql", "trpc"] as const)(
  "ddd-fullstack %s standalone API + Next.js web app",
  (api) => {
    it("enables JSX and Next.js types for the generated web app", async () => {
      const targetDir = await generateStandaloneNextWeb(api);
      const parsed = ts.getParsedCommandLineOfConfigFile(
        join(targetDir, "apps/web/tsconfig.json"),
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: () => undefined,
        },
      );

      expect(parsed?.options.jsx).toBe(ts.JsxEmit.Preserve);
      expect(parsed?.options.lib).toContain("lib.dom.d.ts");
      const config = readFileSync(join(targetDir, "apps/web/tsconfig.json"), "utf8");
      expect(config).toContain('"next-env.d.ts"');
      expect(config).toContain('".next/types/**/*.ts"');
      expect(readFileSync(join(targetDir, "apps/web/next-env.d.ts"), "utf8")).toContain(
        '/// <reference types="next" />',
      );
      expect(readFileSync(join(targetDir, "apps/web/src/css.d.ts"), "utf8")).toContain(
        'declare module "*.css"',
      );
      expect(readFileSync(join(targetDir, "apps/web/src/app/layout.tsx"), "utf8")).toContain(
        "<Providers>{children}</Providers>",
      );
    });

    it("installs the Babel runtime required by the generated Babel configuration", async () => {
      const targetDir = await generateStandaloneNextWeb(api);
      expect(existsSync(join(targetDir, "apps/web/babel.config.js"))).toBe(true);
      const manifest = JSON.parse(
        readFileSync(join(targetDir, "apps/web/package.json"), "utf8"),
      ) as {
        dependencies: Record<string, string>;
      };

      expect(manifest.dependencies).toHaveProperty("@babel/runtime");
    });
  },
);

it("imports HttpLink from Apollo Client in the GraphQL web app", async () => {
  const targetDir = await generateStandaloneNextWeb("graphql");
  const providers = readFileSync(join(targetDir, "apps/web/src/lib/providers.tsx"), "utf8");
  const layout = readFileSync(join(targetDir, "apps/web/src/app/layout.tsx"), "utf8");

  expect(providers).toMatch(/import\s*\{\s*HttpLink\s*\}\s*from\s*["']@apollo\/client["']/);
  expect(layout).toContain("<Providers>{children}</Providers>");
});

it("resolves the standalone API router through a workspace dependency", async () => {
  const targetDir = await generateStandaloneNextWeb("trpc");
  const manifest = JSON.parse(readFileSync(join(targetDir, "apps/web/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const trpc = readFileSync(join(targetDir, "apps/web/src/lib/trpc.ts"), "utf8");

  expect(manifest.dependencies["@acme/api"]).toBe("workspace:*");
  expect(trpc).toContain('import type { AppRouter } from "@acme/api/src/router"');
  expect(
    readFileSync(join(targetDir, "apps/web/src/components/health-check.tsx"), "utf8"),
  ).toContain("trpc.health.check.useQuery()");
});
