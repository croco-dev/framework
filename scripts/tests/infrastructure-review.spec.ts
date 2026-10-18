import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentHash,
  executeEvidence,
  inspectInfrastructureReview,
} from "../infrastructure-review.mts";
import { runReleaseSpineEvidence } from "../release-spine-evidence.mts";

const roots: string[] = [];
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function write(root: string, path: string, value: string | object): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), typeof value === "string" ? value : JSON.stringify(value));
}
function commit(root: string): string {
  git(root, "add", ".");
  git(
    root,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-qm",
    "fixture",
  );
  return git(root, "rev-parse", "HEAD");
}
function fixture(): { root: string; base: string } {
  const root = mkdtempSync(join(tmpdir(), "infra-review-"));
  roots.push(root);
  git(root, "init", "-q");
  write(root, "packages/sample/package.json", { name: "@croco/sample", version: "1.0.0" });
  write(root, "packages/sample/src/index.ts", "export const answer = 41;");
  write(
    root,
    "packages/sample/src/tests/Runtime.spec.ts",
    "import { it, expect } from 'vitest'; it('real host', () => expect(1).toBe(1));",
  );
  write(root, "docs/package-catalog.json", {
    packageRoles: {
      sample: { role: "Plugins", subtype: "provider", runtimes: ["node", "lambda"] },
    },
  });
  return { root, base: commit(root) };
}
function record(root: string): Record<string, unknown> {
  const path = "packages/sample/src/index.ts";
  const reference = "packages/sample/src/tests/Runtime.spec.ts";
  return {
    package: "sample",
    classification: "durable-provider",
    reason: "Adds native Node storage.",
    files: { [path]: contentHash(readFileSync(join(root, path), "utf8")) },
    catalogRuntimes: ["node", "lambda"],
    profiles: {
      kubernetes: {
        result: "supported",
        reason: "Runs with Node.",
        providers: ["sample"],
        constraints: ["Local evidence; no cluster certification."],
        references: [reference],
        evidence: {
          kind: "host-runtime",
          runtime: "node",
          path: reference,
          sha256: contentHash(readFileSync(join(root, reference), "utf8")),
          testName: "real host",
        },
      },
      "aws-lambda": {
        result: "conditional",
        reason: "Requires bounded connections.",
        providers: ["sample"],
        constraints: ["Flush before invocation returns."],
        references: [path],
      },
      cloudflare: {
        result: "unsupported",
        reason: "Requires Node native module.",
        providers: [],
        constraints: ["No Workers implementation."],
        references: [path],
      },
    },
  };
}
function changed(): { root: string; base: string; review: Record<string, unknown> } {
  const { root, base } = fixture();
  write(root, "packages/sample/src/index.ts", "export const answer = 43;");
  return { root, base, review: record(root) };
}
function inspect(input: ReturnType<typeof changed>, run = () => true) {
  write(input.root, "docs/infrastructure-reviews/feature.json", {
    schemaVersion: 1,
    changes: [input.review],
  });
  const head = commit(input.root);
  return inspectInfrastructureReview(input.root, input.base, head, run);
}
function decisions(review: Record<string, unknown>): Record<string, Record<string, unknown>> {
  return review.profiles as Record<string, Record<string, unknown>>;
}

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
describe("host evidence execution", () => {
  it.each([
    {
      scenario: "executes the exact Node HTTP host test",
      testName: "Node host serves a request",
      passed: true,
    },
    { scenario: "rejects a skipped host test", testName: "not executed", passed: false },
    { scenario: "rejects an unmatched host test name", testName: "missing test", passed: false },
    { scenario: "rejects a failed host test", testName: "fails assertion", passed: false },
    {
      scenario: "rejects a passing lookalike from another file",
      testName: "forged title",
      passed: false,
    },
  ])(
    "$scenario",
    ({ testName, passed }) => {
      const { root } = fixture();
      symlinkSync(join(import.meta.dirname, "../../node_modules"), join(root, "node_modules"));
      write(root, "package.json", { private: true, type: "module" });
      write(
        root,
        "vitest.config.mts",
        'export default { test: { include: ["scripts/tests/**/*.spec.ts"] } };',
      );
      const path = "scripts/tests/NodeHost.spec.ts";
      write(
        root,
        path,
        `import { it, expect } from 'vitest';
import { createServer } from 'node:http';
it('Node host serves a request', async () => {
  const server = createServer((_request, response) => response.end('native-node'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port);
    expect(await response.text()).toBe('native-node');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
it.skip('not executed', () => {});
it.skip('forged title', () => {});
it('fails assertion', () => expect('actual').toBe('different'));`,
      );
      write(
        root,
        "scripts/tests/copy/scripts/tests/NodeHost.spec.ts",
        "import { it, expect } from 'vitest'; it('forged title', () => expect(2).toBe(2));",
      );
      expect(executeEvidence(root, { path, testName })).toBe(passed);
    },
    20000,
  );
});

describe("infrastructure review gate", () => {
  it("rejects a public change without a changed review, without backfilling unchanged packages", () => {
    const input = changed();
    const head = commit(input.root);
    expect(
      inspectInfrastructureReview(input.root, input.base, head).diagnostics.map((d) => d.code),
    ).toEqual(["INFRA_REVIEW_MISSING"]);
    expect(inspectInfrastructureReview(input.root, head, head).diagnostics).toEqual([]);
  });
  it("accepts Node evidence with conditional Lambda and unsupported Workers without demanding three implementations", () => {
    const input = changed();
    let executions = 0;
    const result = inspect(input, () => {
      executions++;
      return true;
    });
    expect(result.diagnostics).toEqual([]);
    expect(executions).toBe(1);
    expect(result.reviews[0]?.package).toBe("sample");
  });
  it("executes supported evidence with the real CI reporting runner", async () => {
    const input = changed();
    write(
      input.root,
      ".gitignore",
      readFileSync(join(import.meta.dirname, "../../.gitignore"), "utf8"),
    );
    symlinkSync(join(import.meta.dirname, "../../node_modules"), join(input.root, "node_modules"));
    write(
      input.root,
      "packages/sample/vitest.config.mts",
      'export default { test: { include: ["src/tests/*.spec.ts"] } };',
    );
    write(
      input.root,
      "packages/sample/src/tests/Runtime.spec.ts",
      `import { it, expect } from 'vitest';
import { createServer } from 'node:http';
it('real host', async () => {
  const server = createServer((_request, response) => response.end('owned-package-host'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port);
    expect(await response.text()).toBe('owned-package-host');
  } finally { await new Promise(resolve => server.close(resolve)); }
});`,
    );
    input.review = record(input.root);
    write(input.root, "docs/infrastructure-reviews/feature.json", {
      schemaVersion: 1,
      changes: [input.review],
    });
    const head = commit(input.root);
    const report = await runReleaseSpineEvidence({
      rootDir: input.root,
      outputDir: "ci-reports/verification/publish",
      profile: "repo",
      totalTimeoutMs: 60000,
      commands: [
        {
          id: "infrastructure-review",
          label: "Infrastructure review",
          category: "quality",
          timeoutMs: 30000,
          command: [
            process.execPath,
            "--experimental-strip-types",
            join(import.meta.dirname, "../infrastructure-review.mts"),
            "--base",
            input.base,
            "--head",
            head,
          ],
        },
      ],
    });
    expect(report.status).toBe("passed");
    expect(report.checks[0]?.status).toBe("passed");
    expect(
      readFileSync(join(input.root, "ci-reports/verification/publish/spine-evidence.json"), "utf8"),
    ).toContain("infrastructure-review");
  }, 20000);

  it("rejects evidence execution that changes the reviewed checkout", () => {
    const input = changed();
    const result = inspect(input, () => {
      write(input.root, "packages/sample/src/index.ts", "export const answer = 99;");
      return true;
    });
    expect(result.diagnostics.map((d) => d.code)).toContain("INFRA_EVIDENCE_CHECKOUT");
  });

  it("ignores base-only source, catalog and review additions on a diverged branch", () => {
    const { root, base } = fixture();
    git(root, "checkout", "-qb", "topic");
    write(root, "topic.md", "Topic documentation only.");
    const head = commit(root);
    git(root, "checkout", "-qb", "advanced-base", base);
    write(root, "packages/sample/src/index.ts", "export const answer = 99;");
    write(root, "docs/package-catalog.json", {
      packageRoles: { sample: { role: "Plugins", runtimes: ["cloudflare-workers"] } },
    });
    write(root, "docs/infrastructure-reviews/base-only.json", { schemaVersion: 1, changes: [] });
    const advancedBase = commit(root);
    git(root, "checkout", "topic");
    const result = inspectInfrastructureReview(root, advancedBase, head);
    expect(result.base).toBe(base);
    expect(result.diagnostics).toEqual([]);
    write(root, "packages/sample/src/index.ts", "export const answer = 43;");
    const changedHead = commit(root);
    expect(
      inspectInfrastructureReview(root, advancedBase, changedHead).diagnostics.map((d) => d.code),
    ).toEqual(["INFRA_REVIEW_MISSING"]);
  });

  it.each(["imports", "bin"])(
    "selects runtime manifest %s changes without source changes",
    (field) => {
      const { root, base } = fixture();
      write(root, "packages/sample/package.json", {
        name: "@croco/sample",
        version: "1.0.0",
        [field]:
          field === "imports"
            ? { "#host": { workerd: "./worker.js", node: "./node.js" } }
            : "./cli.js",
      });
      const head = commit(root);
      expect(inspectInfrastructureReview(root, base, head).diagnostics.map((d) => d.code)).toEqual([
        "INFRA_REVIEW_MISSING",
      ]);
    },
  );

  it("selects deployment Profile metadata without a source or catalog change", () => {
    const { root } = fixture();
    write(root, "packages/sample/runtime-profiles.json", {
      profiles: [{ runtime: "lambda", timeout: 30 }],
    });
    const base = commit(root);
    write(root, "packages/sample/runtime-profiles.json", {
      profiles: [{ runtime: "lambda", timeout: 45 }],
    });
    const head = commit(root);
    expect(inspectInfrastructureReview(root, base, head).diagnostics.map((d) => d.code)).toEqual([
      "INFRA_REVIEW_MISSING",
    ]);
  });

  it("selects Unicode source paths without Git quoted-path loss", () => {
    const { root, base } = fixture();
    write(root, "packages/sample/src/새기능.ts", "export const newCapability = 53;");
    const head = commit(root);
    expect(inspectInfrastructureReview(root, base, head).diagnostics.map((d) => d.code)).toEqual([
      "INFRA_REVIEW_MISSING",
    ]);
  });

  it("allows pure contract decisions with reasons and no platform smoke", () => {
    const input = changed();
    input.review.classification = "pure-contract";
    for (const decision of Object.values(decisions(input.review))) {
      decision.result = "not-applicable";
      decision.reason = "Pure domain calculation; no host lifecycle or storage.";
      delete decision.evidence;
    }
    expect(
      inspect(input, () => {
        throw new Error("No smoke should run");
      }).diagnostics,
    ).toEqual([]);
  });
  it.each(["missing", "mock", "failed", "stale"])(
    "rejects %s execution evidence for supported Workers",
    (mode) => {
      const input = changed();
      write(input.root, "docs/package-catalog.json", {
        packageRoles: { sample: { runtimes: ["node", "lambda", "cloudflare-workers"] } },
      });
      input.review.catalogRuntimes = ["node", "lambda", "cloudflare-workers"];
      const profile = decisions(input.review).cloudflare!;
      profile.result = "supported";
      profile.host = "workers";
      profile.evidence = {
        ...(decisions(input.review).kubernetes!.evidence as object),
        runtime: "cloudflare-workers",
      };
      if (mode === "missing") delete profile.evidence;
      if (mode === "mock") (profile.evidence as Record<string, unknown>).kind = "mock";
      if (mode === "stale") (profile.evidence as Record<string, unknown>).sha256 = "old";
      const codes = inspect(input, () => mode !== "failed").diagnostics.map((d) => d.code);
      expect(codes).toContain(
        mode === "failed" ? "INFRA_EXECUTION_FAILED" : "INFRA_EXECUTION_REQUIRED",
      );
    },
  );
  it("rejects missing generated skills on a documentation-only change", () => {
    const { root } = fixture();
    const repository = join(import.meta.dirname, "../..");
    write(
      root,
      "docs/package-catalog.json",
      readFileSync(join(repository, "docs/package-catalog.json"), "utf8"),
    );
    cpSync(join(repository, ".agents/skills/croco"), join(root, ".agents/skills/croco"), {
      recursive: true,
    });
    const generated = "packages/create-croco-app/templates/addons/agent-rules/.agents/skills/croco";
    cpSync(join(repository, generated), join(root, generated), { recursive: true });
    symlinkSync(join(repository, "examples"), join(root, "examples"));
    const apiTemplate = "packages/create-croco-app/templates/saas/apps/api-server/src";
    for (const file of ["compositionRoot.ts", "index.ts", "lambda.ts", "worker.ts"]) {
      write(
        root,
        `${apiTemplate}/${file}`,
        readFileSync(join(repository, apiTemplate, file), "utf8"),
      );
    }
    const base = commit(root);
    expect(inspectInfrastructureReview(root, base, base).diagnostics).toEqual([]);
    rmSync(join(root, generated, "SKILL.md"));
    const head = commit(root);
    expect(inspectInfrastructureReview(root, base, head).diagnostics.map((d) => d.code)).toContain(
      "INFRA_SKILL_DRIFT",
    );
  });

  it("rejects symlinks as executable evidence", () => {
    const input = changed();
    const path = "packages/sample/src/tests/Linked.spec.ts";
    symlinkSync("Runtime.spec.ts", join(input.root, path));
    const profile = decisions(input.review).kubernetes!;
    profile.evidence = {
      ...(profile.evidence as object),
      path,
      sha256: contentHash("Runtime.spec.ts"),
    };
    expect(inspect(input).diagnostics.map((d) => d.code)).toContain("INFRA_EXECUTION_REQUIRED");
  });

  it("rejects stale source bindings and changed runtime claims", () => {
    const input = changed();
    write(input.root, "packages/sample/src/index.ts", "export const answer = 47;");
    write(input.root, "docs/package-catalog.json", {
      packageRoles: { sample: { runtimes: ["node"] } },
    });
    const codes = inspect(input).diagnostics.map((d) => d.code);
    expect(codes).toContain("INFRA_SCOPE_DRIFT");
    expect(codes).toContain("INFRA_RUNTIME_DRIFT");
  });
  it("detects removed reviews even when the implementation is unchanged", () => {
    const input = changed();
    inspect(input);
    const base = git(input.root, "rev-parse", "HEAD");
    git(input.root, "rm", "docs/infrastructure-reviews/feature.json");
    const head = commit(input.root);
    expect(inspectInfrastructureReview(input.root, base, head).diagnostics[0]?.code).toBe(
      "INFRA_REVIEW_REMOVED",
    );
  });
  it("detects a removed package entry within a retained review document", () => {
    const input = changed();
    const otherPath = "packages/other/src/index.ts";
    write(input.root, "packages/other/package.json", { name: "@croco/other" });
    write(input.root, otherPath, "export const other = 59;");
    const other = {
      ...input.review,
      package: "other",
      files: { [otherPath]: contentHash("export const other = 59;") },
    };
    write(input.root, "docs/infrastructure-reviews/feature.json", {
      schemaVersion: 1,
      changes: [input.review, other],
    });
    const base = commit(input.root);
    write(input.root, "docs/infrastructure-reviews/feature.json", {
      schemaVersion: 1,
      changes: [input.review],
    });
    const head = commit(input.root);
    expect(
      inspectInfrastructureReview(input.root, base, head, () => true).diagnostics.map(
        (d) => d.code,
      ),
    ).toContain("INFRA_REVIEW_REMOVED");
  });

  it("ignores formatting but preserves meaningful whitespace inside literals", () => {
    const { root, base } = fixture();
    write(root, "packages/sample/src/index.ts", "// comment only\nexport const answer=41;\n");
    const formatted = commit(root);
    expect(inspectInfrastructureReview(root, base, formatted).diagnostics).toEqual([]);
    write(root, "packages/sample/src/index.ts", 'export const answer = "two words";');
    const literalBase = commit(root);
    write(root, "packages/sample/src/index.ts", 'export const answer = "twowords";');
    const literalHead = commit(root);
    expect(inspectInfrastructureReview(root, literalBase, literalHead).diagnostics[0]?.code).toBe(
      "INFRA_REVIEW_MISSING",
    );
  });

  it("ignores documentation, tests, private packages and release-only version bumps", () => {
    const input = fixture();
    write(input.root, "packages/sample/README.md", "Docs");
    write(input.root, "packages/sample/package.json", { name: "@croco/sample", version: "1.0.1" });
    write(input.root, "packages/sample/src/tests/Extra.spec.ts", "test");
    write(input.root, "packages/private/package.json", { name: "private", private: true });
    write(input.root, "packages/private/src/index.ts", "export const value = 1;");
    const head = commit(input.root);
    expect(inspectInfrastructureReview(input.root, input.base, head).diagnostics).toEqual([]);
  });
  it("validates support changes made only in review metadata", () => {
    const input = changed();
    inspect(input);
    const base = git(input.root, "rev-parse", "HEAD");
    const profile = decisions(input.review).cloudflare!;
    profile.result = "supported";
    profile.host = "workers";
    expect(inspect({ ...input, base }).diagnostics.map((d) => d.code)).toContain(
      "INFRA_EXECUTION_REQUIRED",
    );
  });
});
