import { Problem } from "@croco/problems-core";
import { existsSync, rmSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../cli.js";
import { InvalidGoalOptionProblem } from "../libs/problems/InvalidGoalOptionProblem.js";
import {
  normalizeNonInteractiveOptions,
  parseCliOptions,
  validateCliOptions,
  validateResolvedOptions,
} from "../options.js";
import { assertSaasProviderProfileCapabilities } from "../saas-provider-profiles.js";

const generateMock = vi.hoisted(() => vi.fn());

vi.mock("../generator.js", () => ({
  generate: generateMock,
}));

describe("noninteractive CLI option validation", () => {
  beforeEach(() => {
    generateMock.mockClear();
  });

  it("documents the pnpm-only install contract in CLI help", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("Create a pnpm-based Croco application");
    expect(help).toContain("saas-api|spa-backend-split|worker|internal-tool");
    expect(help).toContain("croco.app.json");
    expect(help).toContain(
      "blank|ddd-api|ddd-fullstack|ddd-vike-fullstack|production-app|admin-console|saas|ai-saas",
    );
    expect(help).toContain("--saas-profile");
    expect(help).toContain("saas-node-postgres|saas-cloudflare|saas-lambda");
    expect(help).toContain("--tenant-model");
    expect(help).toContain("single|org|workspace|shared-schema|rls-backed");
    expect(help).toContain("--no-install");
    expect(help).toContain("Skip pnpm dependency installation");
    expect(help).toContain("--json");
    expect(help).toContain("Print a machine-readable JSON result");
    expect(help).not.toContain("--package-manager");
  });

  it("rejects ddd-api generation when --api is missing", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api is required for ddd-api and ddd-fullstack",
    );
  });

  it("normalizes a goal-first SaaS API request without requiring stack flags", () => {
    const cliOptions = parseCliOptions("my-saas-api", {
      goal: "saas-api",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-saas-api",
      scope: "@test",
      goal: "saas-api",
      preset: "saas",
      tenantModel: "org",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("normalizes a worker goal to the supported Cloudflare Worker preset", () => {
    const cliOptions = parseCliOptions("my-worker", {
      goal: "worker",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-worker",
      scope: "@test",
      goal: "worker",
      preset: "ddd-vike-fullstack",
      webApps: [],
      apiHosting: "standalone",
      frontendDeploy: "cloudflare-meta-vite",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("rejects goal-first requests mixed with stack flags before prompting", () => {
    const cliOptions = parseCliOptions(undefined, {
      goal: "saas-api",
      frontendDeploy: "vercel",
    });

    expect(() => validateCliOptions(cliOptions)).toThrow(
      "--frontend-deploy cannot be combined with --goal saas-api",
    );

    let error: unknown;
    try {
      validateCliOptions(cliOptions);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(InvalidGoalOptionProblem);
    const problem = error as {
      readonly code: string;
      readonly extensions?: { readonly recovery?: string };
    };

    expect(problem.code).toBe("create-croco-app/invalid-goal-option");
    expect(problem.extensions?.recovery).toContain("Remove the stack option");
  });

  it("rejects invalid enum values with actionable messages", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      api: "rest",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      'Invalid --api value "rest". Expected graphql or trpc.',
    );
  });

  it("normalizes SaaS tenant model defaults and explicit choices", () => {
    const defaultOptions = normalizeNonInteractiveOptions(
      parseCliOptions("my-saas", {
        preset: "saas",
        scope: "@test",
        install: false,
        git: false,
      }),
    );
    const workspaceOptions = normalizeNonInteractiveOptions(
      parseCliOptions("my-saas-workspace", {
        preset: "saas",
        scope: "@test",
        saasProfile: "saas-cloudflare",
        tenantModel: "workspace",
        install: false,
        git: false,
      }),
    );

    expect(defaultOptions.tenantModel).toBe("org");
    expect(workspaceOptions).toMatchObject({
      saasProviderProfile: "saas-cloudflare",
      tenantModel: "workspace",
    });
  });

  it("rejects invalid and non-SaaS tenant model options", () => {
    expect(() =>
      normalizeNonInteractiveOptions(
        parseCliOptions("my-saas", {
          preset: "saas",
          scope: "@test",
          tenantModel: "custom",
          install: false,
          git: false,
        }),
      ),
    ).toThrow(
      'Invalid --tenant-model value "custom". Expected single, org, workspace, shared-schema or rls-backed.',
    );

    expect(() =>
      normalizeNonInteractiveOptions(
        parseCliOptions("my-api", {
          preset: "ddd-api",
          scope: "@test",
          api: "trpc",
          tenantModel: "org",
          install: false,
          git: false,
        }),
      ),
    ).toThrow("--tenant-model is only supported with the saas and ai-saas presets");
  });

  it("rejects empty scalar CLI values before prompt or generation", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "",
      api: "trpc",
      install: false,
      git: false,
    });

    expect(() => validateCliOptions(cliOptions)).toThrow("Package scope is required");
  });

  it("rejects deployment flags for blank projects", () => {
    const cliOptions = parseCliOptions("my-blank", {
      preset: "blank",
      scope: "@test",
      frontendDeploy: "vercel",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--frontend-deploy is not supported with the blank preset",
    );
  });

  it("rejects Next.js API hosting for multiple web apps", () => {
    const cliOptions = parseCliOptions("my-fullstack", {
      preset: "ddd-fullstack",
      scope: "@test",
      api: "trpc",
      apiHosting: "nextjs",
      webApps: "web,admin",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api-hosting nextjs requires exactly one web app",
    );
  });

  it("rejects invalid explicit --db values with actionable messages", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      api: "trpc",
      db: "mysql",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      'Invalid --db value "mysql". Expected postgres, mongodb or redis.',
    );
  });

  it("rejects prompt-resolved incompatible options before generation", () => {
    expect(() =>
      validateResolvedOptions({
        projectName: "my-api",
        scope: "@test",
        preset: "ddd-api",
        webApps: ["web"],
        api: "trpc",
        apiHosting: "standalone",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      }),
    ).toThrow("--web-apps is only supported with the ddd-fullstack preset");
  });

  it("rejects invalid project names before generation", async () => {
    const targetDir = `/tmp/croco-invalid-name-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [
            `${targetDir}/InvalidName`,
            "--preset",
            "ddd-api",
            "--scope",
            "@test",
            "--api",
            "trpc",
            "--no-install",
            "--no-git",
          ],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error [create-croco-app/invalid-cli-option]"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Reason: Project name must contain only lowercase letters, numbers, hyphens, and underscores",
        ),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Recovery: Choose a project name"),
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("rejects missing noninteractive --api before creating the target directory", async () => {
    const targetDir = `/tmp/croco-missing-api-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [targetDir, "--preset", "ddd-api", "--scope", "@test", "--no-install", "--no-git"],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error [create-croco-app/invalid-cli-option]"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reason: --api is required for ddd-api and ddd-fullstack"),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Recovery: Pass --api graphql or --api trpc."),
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("prints goal diagnostics with code and recovery before creating the target directory", async () => {
    const targetDir = `/tmp/croco-invalid-goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [
            targetDir,
            "--goal",
            "saas-api",
            "--scope",
            "@test",
            "--frontend-deploy",
            "vercel",
            "--no-install",
            "--no-git",
          ],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error [create-croco-app/invalid-goal-option]"),
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--frontend-deploy"));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Recovery: Remove the stack option"),
      );
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("accepts omitted optional --db in noninteractive CLI generation", async () => {
    const targetDir = `/tmp/croco-no-db-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const program = createProgram();

    await program.parseAsync(
      [
        targetDir,
        "--preset",
        "ddd-api",
        "--scope",
        "@test",
        "--api",
        "trpc",
        "--no-install",
        "--no-git",
      ],
      { from: "user" },
    );

    expect(generateMock).toHaveBeenCalledWith(
      targetDir,
      expect.objectContaining({
        projectName: targetDir.split("/").at(-1),
        db: [],
      }),
    );
  });

  it("prints a JSON success result with next steps for noninteractive consumers", async () => {
    const targetDir = `/tmp/croco-json-success-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await program.parseAsync(
        [targetDir, "--preset", "blank", "--scope", "@test", "--no-install", "--no-git", "--json"],
        { from: "user" },
      );

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
        ok: true,
        code: "create-croco-app/project-created",
        targetDir,
        projectName: targetDir.split("/").at(-1),
        preset: "blank",
        packageManager: "pnpm",
        nextSteps: [`cd ${targetDir}`, "pnpm install", "pnpm dev"],
      });
    } finally {
      logSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("prints a JSON diagnostic for invalid noninteractive options", async () => {
    const targetDir = `/tmp/croco-json-invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit: ${String(code)}`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const program = createProgram();

      await expect(
        program.parseAsync(
          [
            targetDir,
            "--preset",
            "ddd-api",
            "--scope",
            "@test",
            "--api",
            "rest",
            "--no-install",
            "--no-git",
            "--json",
          ],
          { from: "user" },
        ),
      ).rejects.toThrow("process.exit: 1");

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const result = JSON.parse(String(errorSpy.mock.calls[0]?.[0])) as {
        readonly ok: boolean;
        readonly code: string;
        readonly recovery: string;
        readonly diagnostic: {
          readonly code: string;
          readonly detail: string;
          readonly option: string;
        };
      };

      expect(result).toMatchObject({
        ok: false,
        code: "create-croco-app/invalid-cli-option",
        recovery: "Use one of: graphql, trpc.",
        diagnostic: {
          code: "create-croco-app/invalid-cli-option",
          detail: 'Invalid --api value "rest". Expected graphql or trpc.',
          option: "--api",
        },
      });
      expect(existsSync(targetDir)).toBe(false);
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("normalizes safe noninteractive defaults for fullstack projects", () => {
    const cliOptions = parseCliOptions("my-fullstack", {
      preset: "ddd-fullstack",
      scope: "@test",
      api: "graphql",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-fullstack",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("normalizes safe noninteractive defaults for SaaS projects", () => {
    const cliOptions = parseCliOptions("my-saas", {
      preset: "saas",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-saas",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("normalizes safe noninteractive defaults for AI SaaS projects", () => {
    const cliOptions = parseCliOptions("my-ai-saas", {
      preset: "ai-saas",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-ai-saas",
      scope: "@test",
      preset: "ai-saas",
      saasProviderProfile: "saas-node-postgres",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("accepts an explicit SaaS provider profile for SaaS projects", () => {
    const cliOptions = parseCliOptions("my-saas", {
      preset: "saas",
      scope: "@test",
      saasProfile: "saas-cloudflare",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-saas",
      preset: "saas",
      saasProviderProfile: "saas-cloudflare",
    });
  });

  it("rejects invalid SaaS provider profile values with actionable messages", () => {
    const cliOptions = parseCliOptions("my-saas", {
      preset: "saas",
      scope: "@test",
      saasProfile: "custom",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      'Invalid --saas-profile value "custom". Expected saas-node-postgres, saas-cloudflare or saas-lambda.',
    );
  });

  it("rejects SaaS provider profiles outside SaaS presets", () => {
    const cliOptions = parseCliOptions("my-api", {
      preset: "ddd-api",
      scope: "@test",
      api: "trpc",
      saasProfile: "saas-lambda",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--saas-profile is only supported with the saas and ai-saas presets",
    );
  });

  it("fails before generation when a SaaS provider profile lacks a required capability", () => {
    expect(() =>
      assertSaasProviderProfileCapabilities({
        name: "custom",
        capabilities: {},
      }),
    ).toThrow("CROCO_SAAS_PROFILE_CAPABILITY_MISSING: custom lacks runtime");
  });

  it("normalizes safe noninteractive defaults for production app projects", () => {
    const cliOptions = parseCliOptions("my-production-app", {
      preset: "production-app",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-production-app",
      scope: "@test",
      preset: "production-app",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("normalizes safe noninteractive defaults for admin console projects", () => {
    const cliOptions = parseCliOptions("my-admin-console", {
      preset: "admin-console",
      scope: "@test",
      install: false,
      git: false,
      agentRules: false,
    });

    expect(normalizeNonInteractiveOptions(cliOptions)).toMatchObject({
      projectName: "my-admin-console",
      scope: "@test",
      preset: "admin-console",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    });
  });

  it("rejects configurable API flags for SaaS projects", () => {
    const cliOptions = parseCliOptions("my-saas", {
      preset: "saas",
      scope: "@test",
      api: "trpc",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api is not supported with the saas preset",
    );
    let error: unknown;
    try {
      normalizeNonInteractiveOptions(cliOptions);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(Problem);
  });

  it.each([
    [{ api: "trpc" }, "--api is not supported with the saas preset"],
    [{ webApps: "web" }, "--web-apps is not supported with the saas preset"],
    [{ db: "postgres" }, "--db is not supported with the saas preset"],
    [{ backendDeploy: "lambda" }, "--backend-deploy is not supported with the saas preset"],
    [{ frontendDeploy: "vercel" }, "--frontend-deploy is not supported with the saas preset"],
  ] as const)(
    "rejects partial interactive SaaS CLI options before prompting: %o",
    (rawOptions, expectedMessage) => {
      const cliOptions = parseCliOptions(undefined, {
        preset: "saas",
        ...rawOptions,
      });

      expect(() => validateCliOptions(cliOptions)).toThrow(expectedMessage);
    },
  );

  it.each([
    [{ api: "trpc" }, "--api is not supported with the production-app preset"],
    [{ webApps: "web" }, "--web-apps is not supported with the production-app preset"],
    [{ db: "postgres" }, "--db is not supported with the production-app preset"],
    [
      { backendDeploy: "lambda" },
      "--backend-deploy is not supported with the production-app preset",
    ],
    [
      { frontendDeploy: "vercel" },
      "--frontend-deploy is not supported with the production-app preset",
    ],
  ] as const)(
    "rejects configurable production app CLI options before prompting: %o",
    (rawOptions, expectedMessage) => {
      const cliOptions = parseCliOptions(undefined, {
        preset: "production-app",
        ...rawOptions,
      });

      expect(() => validateCliOptions(cliOptions)).toThrow(expectedMessage);
    },
  );

  it.each([
    [{ api: "trpc" }, "--api is not supported with the admin-console preset"],
    [{ webApps: "web" }, "--web-apps is not supported with the admin-console preset"],
    [{ db: "postgres" }, "--db is not supported with the admin-console preset"],
    [
      { backendDeploy: "lambda" },
      "--backend-deploy is not supported with the admin-console preset",
    ],
    [
      { frontendDeploy: "vercel" },
      "--frontend-deploy is not supported with the admin-console preset",
    ],
  ] as const)(
    "rejects configurable admin console CLI options before prompting: %o",
    (rawOptions, expectedMessage) => {
      const cliOptions = parseCliOptions(undefined, {
        preset: "admin-console",
        ...rawOptions,
      });

      expect(() => validateCliOptions(cliOptions)).toThrow(expectedMessage);
    },
  );

  it("rejects configurable API flags for AI SaaS projects", () => {
    const cliOptions = parseCliOptions("my-ai-saas", {
      preset: "ai-saas",
      scope: "@test",
      api: "trpc",
      install: false,
      git: false,
    });

    expect(() => normalizeNonInteractiveOptions(cliOptions)).toThrow(
      "--api is not supported with the ai-saas preset",
    );
  });
});
