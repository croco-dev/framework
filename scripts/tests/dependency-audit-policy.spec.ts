import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runDependencyAuditPolicy } from "../dependency-audit-policy.mts";

const tempRepos: string[] = [];
let advisoryId = 0;

describe("dependency-audit-policy.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("fails high runtime dependency findings without reviewed metadata", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-runtime-risk",
        path: "packages__runtime-core>runtime-lib@1.0.0>vulnerable@2.0.0",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        classification: "runtime",
        directDependency: "runtime-lib",
        metadataStatus: "missing",
      }),
    ]);
  });

  it("fails closed when pnpm audit returns an error JSON object", () => {
    const repo = createRepo();
    writeJson(repo, "audit.json", {
      error: {
        code: "ERR_PNPM_AUDIT_BAD_RESPONSE",
        message: "registry returned 500",
      },
    });

    expect(() =>
      runDependencyAuditPolicy({
        auditJsonPath: "audit.json",
        rootDir: repo,
      }),
    ).toThrow("ERR_PNPM_AUDIT_BAD_RESPONSE");
  });

  it("accepts #1144-compatible reviewBy metadata for runtime findings", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeMetadata(repo, {
      audit: {
        ignoreGhsas: [
          {
            id: "GHSA-runtime-risk",
            owner: "security-owner",
            reason: "Reviewed runtime exception while upstream fix is scheduled.",
            reviewBy: "2027-01-31",
          },
        ],
      },
      schemaVersion: 1,
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-runtime-risk",
        path: "packages__runtime-core>runtime-lib>vulnerable",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(0);
    expect(result.advisoryFindings).toEqual([
      expect.objectContaining({
        classification: "runtime",
        metadataStatus: "reviewed",
      }),
    ]);
  });

  it("accepts #1144-compatible expiresOn metadata for runtime findings", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeMetadata(repo, {
      audit: {
        ignoreGhsas: [
          {
            expiresOn: "2027-01-31",
            id: "GHSA-runtime-risk",
            owner: "security-owner",
            reason: "Reviewed runtime exception while upstream fix is scheduled.",
          },
        ],
      },
      schemaVersion: 1,
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-runtime-risk",
        path: "packages__runtime-core>runtime-lib>vulnerable",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(0);
    expect(result.advisoryFindings).toEqual([
      expect.objectContaining({
        classification: "runtime",
        metadataStatus: "reviewed",
      }),
    ]);
  });

  it("merges production-only audit paths into the policy input", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeAudit(repo, []);
    writeAuditFile(repo, "prod-audit.json", [
      advisory({
        ghsa: "GHSA-prod-runtime",
        path: "packages__runtime-core>runtime-lib>bad",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      prodAuditJsonPath: "prod-audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        classification: "runtime",
        directDependency: "runtime-lib",
      }),
    ]);
  });

  it("keeps dev-only findings advisory even when audit JSON marks them as production paths", () => {
    const repo = createRepo();
    writePackage(repo, "package.json", {
      devDependencies: {
        vitest: "4.0.16",
      },
      name: "croco",
      private: true,
      version: "0.0.0",
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-vitest-risk",
        path: ".>vitest>vite",
        severity: "critical",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(0);
    expect(result.advisoryFindings[0]).toEqual(
      expect.objectContaining({
        classification: "dev-test",
        directDependency: "vitest",
        metadataStatus: "not-required",
      }),
    );
  });

  it("keeps create-croco-app local Vitest installs advisory", () => {
    const repo = createRepo();
    writePackage(repo, "packages/create-croco-app/package.json", {
      devDependencies: {
        vitest: "4.0.16",
      },
      name: "create-croco-app",
      version: "0.1.0",
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-create-croco-app-vitest",
        path: "packages__create-croco-app>vitest",
        severity: "critical",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(0);
    expect(result.advisoryFindings[0]).toEqual(
      expect.objectContaining({
        classification: "dev-test",
        metadataStatus: "not-required",
      }),
    );
  });

  it("elevates generated app template runtime dependency fixtures", () => {
    const repo = createRepo();
    writePackage(repo, "packages/create-croco-app/package.json", {
      name: "create-croco-app",
      version: "0.1.0",
    });
    writeFile(
      repo,
      "packages/create-croco-app/templates/addons/web/package.json.hbs",
      JSON.stringify(
        {
          dependencies: {
            vite: "^6.0.0",
          },
          devDependencies: {
            vitest: "4.0.16",
          },
          name: "{{scope}}/web",
          private: true,
          version: "0.1.0",
        },
        null,
        2,
      ),
    );
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-template-vite",
        path: "packages__create-croco-app__templates__addons__web>vite>bad",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings[0]).toEqual(
      expect.objectContaining({
        classification: "generated-app",
        dependencyField: "dependencies",
      }),
    );
  });

  it("merges generated template audit paths into the policy input", () => {
    const repo = createRepo();
    writePackage(repo, "packages/create-croco-app/package.json", {
      name: "create-croco-app",
      version: "0.1.0",
    });
    writeFile(
      repo,
      "packages/create-croco-app/templates/addons/web/package.json.hbs",
      JSON.stringify(
        {
          dependencies: {
            vite: "^6.0.0",
          },
          name: "{{scope}}/web",
          private: true,
          version: "0.1.0",
        },
        null,
        2,
      ),
    );
    writeAudit(repo, []);
    writeAuditFile(repo, "template-audit.json", [
      advisory({
        ghsa: "GHSA-template-runtime",
        path: "packages__create-croco-app__templates__addons__web>vite",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      templateAuditJsonPath: "template-audit.json",
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        classification: "generated-app",
        directDependency: "vite",
      }),
    ]);
  });

  it("elevates explicit release evidence tools but not generic Vitest paths", () => {
    const repo = createRepo();
    writePackage(repo, "package.json", {
      devDependencies: {
        "@changesets/cli": "2.29.8",
        vitest: "4.0.16",
      },
      name: "croco",
      private: true,
      version: "0.0.0",
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-release-tool",
        path: ".>@changesets/cli>js-yaml",
        severity: "high",
      }),
      advisory({
        ghsa: "GHSA-vitest-risk",
        path: ".>vitest>vite",
        severity: "critical",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        classification: "release-evidence",
        directDependency: "@changesets/cli",
      }),
    ]);
    expect(result.advisoryFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "dev-test",
          directDependency: "vitest",
        }),
      ]),
    );
  });

  it("rejects package.json pnpm auditConfig suppressions as dead policy state", () => {
    const repo = createRepo();
    writePackage(repo, "package.json", {
      name: "croco",
      pnpm: {
        auditConfig: {
          ignoreGhsas: ["GHSA-hidden-risk"],
        },
      },
      private: true,
      version: "0.0.0",
    });
    writeAudit(repo, []);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.violations).toEqual([
      expect.stringContaining("package.json#pnpm.auditConfig configures GHSA-hidden-risk"),
    ]);
  });

  it("rejects examples package.json pnpm auditConfig suppressions as dead policy state", () => {
    const repo = createRepo();
    writePackage(repo, "examples/quick-start/package.json", {
      name: "@croco-example/quick-start",
      pnpm: {
        auditConfig: {
          ignoreGhsas: ["GHSA-example-risk"],
        },
      },
      private: true,
      version: "0.0.0",
    });
    writeAudit(repo, []);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.violations).toEqual([
      expect.stringContaining(
        "examples/quick-start/package.json#pnpm.auditConfig configures GHSA-example-risk",
      ),
    ]);
  });

  it("reads only pnpm-workspace auditConfig suppression ids", () => {
    const repo = createRepo();
    writeFile(
      repo,
      "pnpm-workspace.yaml",
      [
        "packages:",
        "  - packages/*",
        "notes:",
        "  - GHSA-ignored-outside-audit-config",
        "# CVE-2026-9999 is only a comment",
        "auditConfig:",
        "  ignoreGhsas: ['GHSA-workspace-risk']",
        "  ignoreCves:",
        "    - CVE-2026-1234",
        "",
      ].join("\n"),
    );
    writeAudit(repo, []);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
    });

    expect(result.exitCode).toBe(1);
    expect(result.configuredSuppressions).toEqual([
      expect.objectContaining({
        id: "CVE-2026-1234",
        key: "ignoreCves",
        source: "pnpm-workspace.yaml#auditConfig",
      }),
      expect.objectContaining({
        id: "GHSA-workspace-risk",
        key: "ignoreGhsas",
        source: "pnpm-workspace.yaml#auditConfig",
      }),
    ]);
    expect(result.violations.join("\n")).not.toContain("GHSA-ignored-outside-audit-config");
    expect(result.violations.join("\n")).not.toContain("CVE-2026-9999");
  });

  it("rejects pnpm 11 CVE auditConfig suppressions even with matching metadata", () => {
    const repo = createRepo();
    writeMetadata(repo, {
      audit: {
        ignoreCves: [
          {
            id: "CVE-2026-1234",
            owner: "security-owner",
            reason: "Legacy CVE exception carried forward from pnpm 10.",
            reviewBy: "2027-01-31",
          },
        ],
      },
      schemaVersion: 1,
    });
    writeFile(
      repo,
      "pnpm-workspace.yaml",
      [
        "packages:",
        "  - packages/*",
        "auditConfig:",
        "  ignoreCves:",
        "    - CVE-2026-1234",
        "",
      ].join("\n"),
    );
    writeAudit(repo, []);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(1);
    expect(result.violations).toEqual([
      expect.stringContaining(
        "pnpm 11 audit policy requires GHSA IDs under ignoreGhsas because ignoreCves/CVE suppressions are not recognized",
      ),
    ]);
  });

  it("does not treat CVE-only metadata as reviewed for GHSA audit findings", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeMetadata(repo, {
      audit: {
        ignoreCves: [
          {
            id: "CVE-2026-1234",
            owner: "security-owner",
            reason: "Legacy CVE exception carried forward from pnpm 10.",
            reviewBy: "2027-01-31",
          },
        ],
      },
      schemaVersion: 1,
    });
    writeAudit(repo, [
      advisory({
        cves: ["CVE-2026-1234"],
        ghsa: "GHSA-runtime-risk",
        path: "packages__runtime-core>runtime-lib>vulnerable",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings).toEqual([
      expect.objectContaining({
        metadataStatus: "missing",
      }),
    ]);
  });

  it("fails stale metadata for blocking findings", () => {
    const repo = createRepo();
    writePackage(repo, "packages/runtime-core/package.json", {
      name: "@croco/runtime-core",
      version: "0.0.1",
      dependencies: {
        "runtime-lib": "1.0.0",
      },
    });
    writeMetadata(repo, {
      audit: {
        ignoreGhsas: [
          {
            id: "GHSA-runtime-risk",
            owner: "security-owner",
            reason: "Expired runtime exception.",
            reviewDate: "2026-01-01",
          },
        ],
      },
      schemaVersion: 1,
    });
    writeAudit(repo, [
      advisory({
        ghsa: "GHSA-runtime-risk",
        path: "packages__runtime-core>runtime-lib>vulnerable",
        severity: "high",
      }),
    ]);

    const result = runDependencyAuditPolicy({
      auditJsonPath: "audit.json",
      rootDir: repo,
      today: "2026-07-03",
    });

    expect(result.exitCode).toBe(1);
    expect(result.blockingFindings[0]).toEqual(
      expect.objectContaining({
        metadataStatus: "invalid",
      }),
    );
  });
});

function createRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-dependency-audit-policy-"));
  tempRepos.push(repo);
  writePackage(repo, "package.json", {
    name: "croco",
    private: true,
    version: "0.0.0",
  });
  return repo;
}

function advisory(options: {
  readonly cves?: readonly string[];
  readonly ghsa: string;
  readonly path: string;
  readonly severity: "critical" | "high" | "moderate" | "low";
}) {
  return {
    cves: options.cves ?? [],
    findings: [
      {
        paths: [options.path],
        version: "1.0.0",
      },
    ],
    github_advisory_id: options.ghsa,
    id: ++advisoryId,
    module_name: options.path.split(">").at(-1) ?? "vulnerable",
    severity: options.severity,
    title: `${options.ghsa} fixture`,
    url: `https://github.com/advisories/${options.ghsa}`,
  };
}

function writeAudit(repo: string, advisories: readonly ReturnType<typeof advisory>[]): void {
  writeAuditFile(repo, "audit.json", advisories);
}

function writeAuditFile(
  repo: string,
  path: string,
  advisories: readonly ReturnType<typeof advisory>[],
): void {
  writeJson(repo, path, {
    advisories: Object.fromEntries(advisories.map((entry) => [entry.id, entry])),
    metadata: {
      vulnerabilities: {},
    },
  });
}

function writeMetadata(repo: string, metadata: Record<string, unknown>): void {
  writeJson(repo, "scripts/security-allowlist-metadata.json", metadata);
}

function writePackage(repo: string, path: string, manifest: Record<string, unknown>): void {
  writeJson(repo, path, manifest);
}

function writeJson(repo: string, path: string, value: Record<string, unknown>): void {
  writeFile(repo, path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(repo: string, path: string, contents: string): void {
  const fullPath = join(repo, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}
