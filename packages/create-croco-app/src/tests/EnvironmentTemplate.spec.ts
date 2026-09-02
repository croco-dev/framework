import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnvironmentTemplateSnapshot } from "../environment-template.js";
import { generate } from "../generator.js";
import { scanGeneratedTemplateSecretText } from "../secret-placeholder-policy.js";
import type { GeneratorOptions } from "../types.js";

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "../../templates");

const scaffoldCases = [
  {
    preset: "blank",
    expectedVariables: [],
    options: {
      projectName: "blank-app",
      scope: "@test",
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-api",
    expectedVariables: ["DATABASE_URL", "GRAPHQL_AUTH_TOKEN"],
    options: {
      projectName: "ddd-api-app",
      scope: "@test",
      preset: "ddd-api",
      webApps: [],
      api: "graphql",
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-fullstack",
    expectedVariables: ["DATABASE_URL", "NEXT_PUBLIC_API_URL"],
    options: {
      projectName: "ddd-fullstack-app",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "nextjs",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-vike-fullstack",
    expectedVariables: ["DATABASE_URL", "WEB_ORIGIN"],
    options: {
      projectName: "ddd-vike-fullstack-app",
      scope: "@test",
      preset: "ddd-vike-fullstack",
      webApps: [],
      api: "graphql",
      apiHosting: "standalone",
      frontendDeploy: "cloudflare-meta-vite",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-fullstack",
    expectedVariables: ["DATABASE_URL", "GRAPHQL_AUTH_TOKEN"],
    options: {
      projectName: "ddd-meta-vite-fullstack-app",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      frontendDeploy: "cloudflare-meta-vite",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-fullstack",
    expectedVariables: ["DATABASE_URL", "NEXT_PUBLIC_API_URL"],
    options: {
      projectName: "ddd-nextjs-meta-vite-fullstack-app",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "nextjs",
      frontendDeploy: "cloudflare-meta-vite",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-fullstack",
    expectedVariables: ["DATABASE_URL", "NEXT_PUBLIC_API_URL", "VITE_API_URL"],
    options: {
      projectName: "ddd-nextjs-vite-fullstack-app",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "nextjs",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ddd-fullstack",
    expectedVariables: ["DATABASE_URL"],
    options: {
      projectName: "ddd-empty-vite-fullstack-app",
      scope: "@test",
      preset: "ddd-fullstack",
      webApps: [],
      api: "trpc",
      apiHosting: "standalone",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "production-app",
    expectedVariables: [
      "NODE_ENV",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "PORT",
      "TELEMETRY_ENABLED",
      "VITE_API_URL",
      "WEB_ORIGIN",
    ],
    options: {
      projectName: "production-app",
      scope: "@test",
      preset: "production-app",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "admin-console",
    expectedVariables: [
      "NODE_ENV",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "PORT",
      "TELEMETRY_ENABLED",
      "VITE_API_URL",
      "WEB_ORIGIN",
    ],
    options: {
      projectName: "admin-console-app",
      scope: "@test",
      preset: "admin-console",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "saas",
    expectedVariables: [
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "CLOUDINARY_URL",
      "DATABASE_URL",
      "NODE_ENV",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "POLAR_ACCESS_TOKEN",
      "POLAR_PRODUCT_ID_TEAM",
      "POLAR_WEBHOOK_SECRET",
      "PORT",
      "SAAS_DEMO_ENDPOINTS_ENABLED",
      "SAAS_PROVIDER_PROFILE",
      "TELEMETRY_ENABLED",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      "UPSTASH_QSTASH_TOKEN",
      "WEB_ORIGIN",
    ],
    options: {
      projectName: "saas-app",
      scope: "@test",
      preset: "saas",
      saasProviderProfile: "saas-node-postgres",
      tenantModel: "org",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
  {
    preset: "ai-saas",
    expectedVariables: [
      "CLERK_SECRET_KEY",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "NODE_ENV",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
      "POLAR_ACCESS_TOKEN",
      "POLAR_PRODUCT_ID_TEAM",
      "POLAR_WEBHOOK_SECRET",
      "PORT",
      "R2_BUCKET",
      "SAAS_DEMO_ENDPOINTS_ENABLED",
      "SAAS_PROVIDER_PROFILE",
      "TELEMETRY_ENABLED",
      "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
      "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
      "UPSTASH_QSTASH_TOKEN",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "WEB_ORIGIN",
    ],
    options: {
      projectName: "ai-saas-app",
      scope: "@test",
      preset: "ai-saas",
      saasProviderProfile: "saas-cloudflare",
      tenantModel: "workspace",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    },
  },
] as const satisfies readonly {
  readonly preset: GeneratorOptions["preset"];
  readonly expectedVariables: readonly string[];
  readonly options: GeneratorOptions;
}[];

describe("generated environment templates", () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "croco-environment-template-"));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it.each(scaffoldCases)(
    "generates a safe template for $preset",
    async ({ preset, expectedVariables, options }) => {
      const targetDir = join(testRoot, preset);

      await generate(targetDir, options);

      const envExamplePath = join(targetDir, ".env.example");
      expect(existsSync(envExamplePath)).toBe(true);
      expect(existsSync(join(targetDir, ".env"))).toBe(false);

      const envExample = readFileSync(envExamplePath, "utf8");
      expect(envExample).toContain("Copy this file to .env");
      expect(readActiveAssignments(envExample)).toEqual([]);
      expect([...readCommentedAssignmentNames(envExample)].sort()).toEqual(
        [...expectedVariables].sort(),
      );
      expect(scanGeneratedTemplateSecretText(".env.example", envExample)).toEqual([]);
    },
  );

  it.each(["blank", "base-ddd", "spa-be-split", "admin-console"] as const)(
    "keeps the $template template snapshot synchronized with the variable catalog",
    (template) => {
      expect(readFileSync(join(templatesDir, template, ".env.example"), "utf8")).toBe(
        renderEnvironmentTemplateSnapshot(template),
      );
    },
  );
});

function readActiveAssignments(content: string): readonly string[] {
  return content.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
}

function readCommentedAssignmentNames(content: string): readonly string[] {
  return content.split(/\r?\n/).flatMap((line) => {
    const match = /^#\s+([A-Z][A-Z0-9_]*)=/.exec(line);
    return match?.[1] === undefined ? [] : [match[1]];
  });
}
