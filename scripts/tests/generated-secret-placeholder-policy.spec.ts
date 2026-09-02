import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../generated-secret-placeholder-policy.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("generated-secret-placeholder-policy.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes generated templates with safe Croco placeholders", () => {
    const root = createTempRoot();
    writeRepo(root, {
      templateFiles: {
        "templates/.env.example": [
          "SAAS_PROVIDER_PROFILE=saas-cloudflare",
          "CLOUDFLARE_API_TOKEN=<croco-secret:CLOUDFLARE_API_TOKEN>",
          "R2_BUCKET=<croco-config:R2_BUCKET>",
        ].join("\n"),
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("generated-secret-placeholder-policy: passed");
  });

  it("fails generated templates with real-looking credential values", () => {
    const root = createTempRoot();
    writeRepo(root, {
      templateFiles: {
        "templates/.env.example": "POLAR_ACCESS_TOKEN=polar_live_token_1234567890\n",
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("generated-secret-placeholder-policy: failed");
    expect(result.stdout).toContain("templates/.env.example:1 contains secret-env-assignment");
  });

  it("fails generated templates with every secret-marked provider env assignment name", () => {
    const root = createTempRoot();
    writeRepo(root, {
      templateFiles: {
        "templates/.env.example": [
          "BETTER_AUTH_SECRET=unsafeSecretValue123",
          "CLERK_SECRET_KEY=unsafeSecretValue123",
          "CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef",
          "CLOUDFLARE_API_TOKEN=unsafeSecretValue123",
          "CLOUDINARY_URL=cloudinary://unsafeSecretValue123",
          "DATABASE_URL=postgres://unsafeSecretValue123",
          "# GRAPHQL_AUTH_TOKEN=unsafeSecretValue123",
          "POLAR_ACCESS_TOKEN=unsafeSecretValue123",
          "POLAR_WEBHOOK_SECRET=unsafeSecretValue123",
          "UPSTASH_QSTASH_CURRENT_SIGNING_KEY=unsafeSecretValue123",
          "UPSTASH_QSTASH_NEXT_SIGNING_KEY=unsafeSecretValue123",
          "UPSTASH_QSTASH_TOKEN=unsafeSecretValue123",
          "UPSTASH_REDIS_REST_TOKEN=unsafeSecretValue123",
          "UPSTASH_REDIS_REST_URL=https://unsafe.example.com",
        ].join("\n"),
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout.match(/contains secret-env-assignment/g)).toHaveLength(14);
    expect(result.stdout).toContain(
      "templates/.env.example:3 contains secret-env-assignment shaped value CLOUDFLARE_ACCOUNT_ID=0123456789abcdef0123456789abcdef",
    );
  });

  it("honors reviewed generated-template allowlists", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadata: metadataFixture({
        generatedTemplateAllowlists: [
          {
            pathPattern: "^templates/fixture\\.env$",
            matchPattern: "^POLAR_ACCESS_TOKEN=",
            owner: "security",
            reason: "Intentional scanner fixture for generated template allowlist tests.",
            reviewBy: "2027-01-31",
          },
        ],
      }),
      templateFiles: {
        "templates/fixture.env": "POLAR_ACCESS_TOKEN=polar_live_token_1234567890\n",
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 generated template allowlists");
  });

  it("reports malformed security allowlist metadata as a policy violation", () => {
    const root = createTempRoot();
    writeRepo(root, {
      metadataText: "{ invalid-json",
      templateFiles: {
        "templates/.env.example": "R2_BUCKET=<croco-config:R2_BUCKET>\n",
      },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("generated-secret-placeholder-policy: failed");
    expect(result.stdout).toContain("security allowlist metadata is invalid JSON");
    expect(result.stdout).toContain("Recovery: Fix the JSON syntax:");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-generated-secret-policy-"));
  tempRoots.push(root);
  return root;
}

function writeRepo(
  root: string,
  options: {
    readonly metadata?: Record<string, unknown>;
    readonly metadataText?: string;
    readonly templateFiles?: Record<string, string>;
  } = {},
): void {
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "templates"), { recursive: true });
  writeFileSync(
    join(root, "scripts/security-allowlist-metadata.json"),
    options.metadataText ?? `${JSON.stringify(options.metadata ?? metadataFixture(), null, 2)}\n`,
  );

  for (const [relativePath, content] of Object.entries(options.templateFiles ?? {})) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
}

function metadataFixture(
  options: {
    readonly generatedTemplateAllowlists?: readonly Record<string, unknown>[];
  } = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    audit: {
      ignoreGhsas: [],
      ignoreCves: [],
    },
    secretScan: {
      gitleaks: {
        configPath: ".gitleaks.toml",
        allowlists: [],
        ignoreFingerprints: [],
      },
      generatedTemplates: {
        allowlists: options.generatedTemplateAllowlists ?? [],
      },
    },
  };
}

function runScript(root: string): ScriptResult {
  const result = spawnSync(
    "node",
    [
      "--experimental-strip-types",
      scriptPath,
      "--root",
      root,
      "--path",
      "templates",
      "--today",
      "2026-07-03",
    ],
    {
      encoding: "utf-8",
      timeout: 10_000,
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
