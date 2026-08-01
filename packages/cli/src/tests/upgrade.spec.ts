import { writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCrocoCommand } from "../commands/root.js";
import { runUpgrade } from "../commands/upgrade.js";
import {
  applyUpgradeRules,
  legacyHttpSecurityUpgradeRule,
  routeConfigUpgradeRule,
  unsafeSecurityValidationRule,
} from "../commands/upgradeRules.js";
import type { UpgradeRule } from "../commands/upgradeRules.js";

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

  it.each([
    {
      rule: routeConfigUpgradeRule,
      content: legacySpaRoute(),
      expected: {
        code: "CROCO_CLI_UPGRADE_001",
        ruleId: "meta-vite-route-config",
        title: "Legacy SPA routeConfig has a meta-vite migration suggestion",
        confidence: "manual",
        action: "confirm",
        message:
          "Generated SPA routeConfig shape matched the known Croco template, but changing route runtime semantics requires confirmation before rewriting it to @croco/meta-vite defineRoute output.",
      },
    },
    {
      rule: routeConfigUpgradeRule,
      content: "export const routeConfig = createRoute({ path: '/custom' });\n",
      expected: {
        code: "CROCO_CLI_UPGRADE_002",
        ruleId: "unsupported-route-config",
        title: "Route config requires manual migration",
        confidence: "manual",
        action: "confirm",
        message:
          "routeConfig was found, but its shape does not match the generated Croco SPA template. Review the route contract before rewriting it.",
      },
    },
    {
      rule: legacyHttpSecurityUpgradeRule,
      content: "problem.code === 'transports-http/security-middleware-validation';\n",
      expected: {
        code: "CROCO_CLI_UPGRADE_003",
        ruleId: "legacy-http-security-diagnostic-code",
        title: "Legacy HTTP security diagnostic code can migrate",
        confidence: "safe",
        action: "rewrite",
        message:
          "Problem.code matchers for transports-http/security-middleware-validation can be rewritten to CROCO_HTTP_SECURITY_001 while legacyCode remains available for rollout compatibility.",
      },
    },
    {
      rule: unsafeSecurityValidationRule,
      content: "const options = { unsafeSkipSecurityValidation: true };\n",
      expected: {
        code: "CROCO_CLI_UPGRADE_004",
        ruleId: "unsafe-security-validation",
        title: "Security validation opt-out needs confirmation",
        confidence: "manual",
        action: "confirm",
        message:
          "Security validation is disabled. The migration assistant leaves this unchanged because production intent, middleware coverage, and local fixture scope must be confirmed first.",
      },
    },
    {
      rule: legacyHttpSecurityUpgradeRule,
      content: "const fixture = 'transports-http/security-middleware-validation';\n",
      expected: {
        code: "CROCO_CLI_UPGRADE_005",
        ruleId: "legacy-http-security-compatibility-string",
        title: "Legacy HTTP security compatibility string needs confirmation",
        confidence: "manual",
        action: "confirm",
        message:
          "A transports-http/security-middleware-validation string was found outside a Problem.code matcher. The migration assistant leaves it unchanged because legacyCode compatibility, fixtures, and documentation references can intentionally keep the legacy value.",
      },
    },
  ])("should preserve finding metadata for $expected.code", ({ rule, content, expected }) => {
    expect(
      rule.analyze(content).findings.map((finding) => ({
        code: finding.code,
        ruleId: finding.ruleId,
        title: finding.title,
        confidence: finding.confidence,
        action: finding.action,
        message: finding.message,
      })),
    ).toEqual([expected]);
  });

  it("should preserve deterministic registry ordering when multiple rules match", () => {
    const content = `${legacySpaRoute()}
problem.code === 'transports-http/security-middleware-validation';
const fixture = 'transports-http/security-middleware-validation';
const options = { unsafeSkipSecurityValidation: true };
`;

    expect(applyUpgradeRules(content).findings.map((finding) => finding.code)).toEqual([
      "CROCO_CLI_UPGRADE_001",
      "CROCO_CLI_UPGRADE_003",
      "CROCO_CLI_UPGRADE_005",
      "CROCO_CLI_UPGRADE_004",
    ]);
  });

  it("should transform the safe fixture byte-for-byte and remain idempotent", async () => {
    const fixtureRoot = new URL(
      "./fixtures/upgrade/legacy-http-security-diagnostic-code/",
      import.meta.url,
    );
    const before = await fs.readFile(new URL("before.ts", fixtureRoot), "utf-8");
    const after = await fs.readFile(new URL("after.ts", fixtureRoot), "utf-8");
    const first = applyUpgradeRules(before);
    const second = applyUpgradeRules(first.updatedContent);

    expect(first.findings.map((finding) => finding.code)).toEqual(["CROCO_CLI_UPGRADE_003"]);
    expect(first.updatedContent).toBe(after);
    expect(second.findings).toEqual([]);
    expect(second.updatedContent).toBe(after);
  });

  it("should write a safe codemod only on the first write-mode run", async () => {
    const cwd = await createWorkspace();
    const sourcePath = path.join(cwd, "apps", "api-server", "src", "problemMatchers.ts");
    const before = await fs.readFile(
      new URL("./fixtures/upgrade/legacy-http-security-diagnostic-code/before.ts", import.meta.url),
      "utf-8",
    );
    const firstStdout: string[] = [];
    const secondStdout: string[] = [];
    let firstWriteCalls = 0;
    let secondWriteCalls = 0;

    await writeFile(sourcePath, before);

    const firstExitCode = await runUpgrade(["--cwd", cwd, "--write", sourcePath], {
      io: {
        stdout: (message) => firstStdout.push(message),
        writeFile: (file, content) => {
          firstWriteCalls += 1;
          writeFileSync(file, content);
        },
      },
    });
    const secondExitCode = await runUpgrade(["--cwd", cwd, "--write", sourcePath], {
      io: {
        stdout: (message) => secondStdout.push(message),
        writeFile: () => {
          secondWriteCalls += 1;
        },
      },
    });

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(firstStdout.join("\n")).toContain(
      "Safe codemods: 1; manual confirmations: 0; applied codemods: 1.",
    );
    expect(secondStdout.join("\n")).toContain(
      "Safe codemods: 0; manual confirmations: 0; applied codemods: 0.",
    );
    expect(firstWriteCalls).toBe(1);
    expect(secondWriteCalls).toBe(0);
  });

  it("should keep manual findings without mutation on repeated runs", async () => {
    const cwd = await createWorkspace();
    const sourcePath = path.join(cwd, "apps", "api-server", "src", "index.ts");
    const content = "export const options = { unsafeSkipSecurityValidation: true };\n";
    const outputs: string[] = [];
    let writeCalls = 0;

    await writeFile(sourcePath, content);

    for (let run = 0; run < 2; run += 1) {
      const exitCode = await runUpgrade(["--cwd", cwd, "--write", sourcePath], {
        io: {
          stdout: (message) => outputs.push(message),
          writeFile: () => {
            writeCalls += 1;
          },
        },
      });

      expect(exitCode).toBe(0);
    }

    expect(outputs.filter((output) => output.includes("CROCO_CLI_UPGRADE_004"))).toHaveLength(2);
    expect(await fs.readFile(sourcePath, "utf-8")).toBe(content);
    expect(writeCalls).toBe(0);
  });

  it("should analyze immutable input and reject cross-rule overlaps before mutation", () => {
    const analyzedContents: string[] = [];
    const createRule = (id: string, start: number, end: number): UpgradeRule => ({
      id,
      analyze(content) {
        analyzedContents.push(content);
        return {
          findings: [],
          replacements: [{ start, end, text: id }],
        };
      },
    });
    const content = "abcdef";

    expect(() =>
      applyUpgradeRules(content, [createRule("first", 1, 4), createRule("second", 3, 5)]),
    ).toThrow("Upgrade codemod replacements overlap.");
    expect(analyzedContents).toEqual([content, content]);
    expect(content).toBe("abcdef");
  });

  it("should preserve the JSON report version and finding contract", async () => {
    const cwd = await createWorkspace();
    const sourcePath = path.join(cwd, "apps", "api-server", "src", "problemMatchers.ts");
    const stdout: string[] = [];

    await writeFile(
      sourcePath,
      "problem.code === 'transports-http/security-middleware-validation';\n",
    );

    const exitCode = await runUpgrade(["--cwd", cwd, "--json", sourcePath], {
      io: { stdout: (message) => stdout.push(message) },
    });
    const report = JSON.parse(stdout.join("\n")) as Record<string, unknown>;

    expect(exitCode).toBe(0);
    expect(report).toMatchObject({
      version: "croco.upgrade.report.v1",
      mode: "dry-run",
      summary: {
        filesScanned: 1,
        findings: 1,
        safeCodemods: 1,
        manualConfirmations: 0,
        appliedCodemods: 0,
      },
      findings: [
        {
          code: "CROCO_CLI_UPGRADE_003",
          ruleId: "legacy-http-security-diagnostic-code",
          title: "Legacy HTTP security diagnostic code can migrate",
          confidence: "safe",
          action: "rewrite",
          message:
            "Problem.code matchers for transports-http/security-middleware-validation can be rewritten to CROCO_HTTP_SECURITY_001 while legacyCode remains available for rollout compatibility.",
          location: { file: "apps/api-server/src/problemMatchers.ts", line: 1, column: 18 },
          applied: false,
        },
      ],
    });
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
