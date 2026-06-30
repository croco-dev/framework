import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCrocoCommand } from "../commands/root.js";
import { runUpgrade } from "../commands/upgrade.js";

const tmpRoots: string[] = [];

describe("upgrade command", () => {
  afterEach(async () => {
    await Promise.all(
      tmpRoots.splice(0).map((tmpRoot) => fs.rm(tmpRoot, { recursive: true, force: true })),
    );
  });

  it("should expose the upgrade assistant command from the root CLI", () => {
    expect(Object.keys(createCrocoCommand().subCommands ?? {})).toContain("upgrade");
  });

  it("should report a generated route migration suggestion in dry-run mode", async () => {
    const cwd = await createWorkspace();
    const routePath = path.join(cwd, "apps", "console-web", "pages", "settings", "route.ts");
    const originalRoute = legacySpaRoute();
    const stdout: string[] = [];

    await writeFile(routePath, originalRoute);

    const exitCode = await runUpgrade(["apps/console-web/pages/settings/route.ts", "--cwd", cwd], {
      io: {
        stdout: (message) => stdout.push(message),
      },
    });

    const report = stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(await fs.readFile(routePath, "utf-8")).toBe(originalRoute);
    expect(report).toContain("Croco upgrade assistant dry-run scanned 1 file(s)");
    expect(report).toContain("Safe codemods: 0; manual confirmations: 1; applied codemods: 0.");
    expect(report).toContain(
      "MANUAL CROCO_CLI_UPGRADE_001 apps/console-web/pages/settings/route.ts:1:1",
    );
    expect(report).toContain("--- before/apps/console-web/pages/settings/route.ts");
    expect(report).toContain("+++ after/apps/console-web/pages/settings/route.ts");
    expect(report).toContain(
      "+import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';",
    );
    expect(report).toContain("-export const routeConfig = {");
    expect(report).toContain("Status: confirmation required; no rewrite was applied.");
  });

  it("should apply safe codemods while leaving uncertain changes for confirmation", async () => {
    const cwd = await createWorkspace();
    const routePath = path.join(cwd, "apps", "console-web", "pages", "settings", "route.ts");
    const apiPath = path.join(cwd, "apps", "api-server", "src", "index.ts");
    const matcherPath = path.join(cwd, "apps", "api-server", "src", "problemMatchers.ts");
    const stdout: string[] = [];

    await writeFile(routePath, legacySpaRoute());
    await writeFile(
      apiPath,
      `export const appOptions = {
  unsafeSkipSecurityValidation: true,
};
`,
    );
    await writeFile(
      matcherPath,
      `export function matches(problem: { readonly code: string }): boolean {
  return problem.code === 'transports-http/security-middleware-validation';
}
`,
    );

    const exitCode = await runUpgrade(["--cwd", cwd, "--write", "."], {
      io: {
        stdout: (message) => stdout.push(message),
      },
    });

    const routeContent = await fs.readFile(routePath, "utf-8");
    const apiContent = await fs.readFile(apiPath, "utf-8");
    const matcherContent = await fs.readFile(matcherPath, "utf-8");
    const report = stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(routeContent).toBe(legacySpaRoute());
    expect(apiContent).toContain("unsafeSkipSecurityValidation: true");
    expect(matcherContent).toContain("CROCO_HTTP_SECURITY_001");
    expect(matcherContent).not.toContain("transports-http/security-middleware-validation");
    expect(report).toContain("Safe codemods: 1; manual confirmations: 2; applied codemods: 1.");
    expect(report).toContain(
      "MANUAL CROCO_CLI_UPGRADE_001 apps/console-web/pages/settings/route.ts:1:1",
    );
    expect(report).toContain("MANUAL CROCO_CLI_UPGRADE_004 apps/api-server/src/index.ts:2:3");
    expect(report).toContain("Status: confirmation required; no rewrite was applied.");
  });

  it("should print a JSON report for legacy diagnostic code matcher migrations", async () => {
    const cwd = await createWorkspace();
    const sourcePath = path.join(cwd, "apps", "api-server", "src", "problemMatchers.ts");
    const stdout: string[] = [];

    await writeFile(
      sourcePath,
      `export function matches(problem: { readonly code: string }): boolean {
  return 'transports-http/security-middleware-validation' === problem.code;
}
`,
    );

    const exitCode = await runUpgrade(["--cwd", cwd, "--json", "apps/api-server/src"], {
      io: {
        stdout: (message) => stdout.push(message),
      },
    });
    const report = JSON.parse(stdout.join("\n")) as {
      readonly summary: { readonly safeCodemods: number; readonly appliedCodemods: number };
      readonly findings: readonly [{ readonly code: string; readonly diff: string }];
    };

    expect(exitCode).toBe(0);
    expect(report.summary.safeCodemods).toBe(1);
    expect(report.summary.appliedCodemods).toBe(0);
    expect(report.findings[0].code).toBe("CROCO_CLI_UPGRADE_003");
    expect(report.findings[0].diff).toContain(
      "-  return 'transports-http/security-middleware-validation' === problem.code;",
    );
    expect(report.findings[0].diff).toContain(
      "+  return 'CROCO_HTTP_SECURITY_001' === problem.code;",
    );
    expect(await fs.readFile(sourcePath, "utf-8")).toContain(
      "transports-http/security-middleware-validation",
    );
  });

  it("should leave legacyCode compatibility checks as manual confirmations", async () => {
    const cwd = await createWorkspace();
    const sourcePath = path.join(cwd, "apps", "api-server", "src", "legacyCodeMatchers.ts");
    const stdout: string[] = [];

    await writeFile(
      sourcePath,
      `export function matches(problem: { readonly extensions?: { readonly legacyCode?: string } }): boolean {
  return problem.extensions?.legacyCode === 'transports-http/security-middleware-validation';
}
`,
    );

    const exitCode = await runUpgrade(["--cwd", cwd, "--write", "apps/api-server/src"], {
      io: {
        stdout: (message) => stdout.push(message),
      },
    });
    const content = await fs.readFile(sourcePath, "utf-8");
    const report = stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(content).toContain("problem.extensions?.legacyCode");
    expect(content).toContain("transports-http/security-middleware-validation");
    expect(content).not.toContain("CROCO_HTTP_SECURITY_001");
    expect(report).toContain("Safe codemods: 0; manual confirmations: 1; applied codemods: 0.");
    expect(report).toContain("MANUAL CROCO_CLI_UPGRADE_005");
  });

  it("should not rewrite routeConfig shapes that do not match the generated template", async () => {
    const cwd = await createWorkspace();
    const routePath = path.join(cwd, "apps", "console-web", "pages", "custom", "route.ts");
    const stdout: string[] = [];

    await writeFile(
      routePath,
      `export const routeConfig = createRoute({
  path: "/custom",
});
`,
    );

    const exitCode = await runUpgrade(["--cwd", cwd, "--write", "apps/console-web"], {
      io: {
        stdout: (message) => stdout.push(message),
      },
    });

    const report = stdout.join("\n");

    expect(exitCode).toBe(0);
    expect(await fs.readFile(routePath, "utf-8")).toContain("createRoute");
    expect(report).toContain(
      "MANUAL CROCO_CLI_UPGRADE_002 apps/console-web/pages/custom/route.ts:1:1",
    );
    expect(report).toContain("Safe codemods: 0; manual confirmations: 1; applied codemods: 0.");
  });
});

async function createWorkspace(): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "croco-cli-upgrade-"));

  tmpRoots.push(cwd);
  await fs.mkdir(path.join(cwd, "apps", "console-web", "pages"), { recursive: true });
  await fs.mkdir(path.join(cwd, "apps", "api-server", "src"), { recursive: true });

  return cwd;
}

async function writeFile(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

function legacySpaRoute(): string {
  return `import Page from './Page';

export const routeConfig = {
  path: '/settings',
  Component: Page,
};
`;
}
