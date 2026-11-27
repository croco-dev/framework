import { appendFileSync } from "node:fs";
import { env, stdout } from "node:process";

export type SecurityPolicyEnforcement = "enforce" | "warn";

export type ReviewDeadlineEntry = {
  readonly expiresOn?: string;
  readonly reviewBy?: string;
};

export type OverdueReview = {
  readonly message: string;
  readonly recovery: string;
};

// Deadlines are compared as YYYY-MM-DD strings, so no review date is before this one.
export const NO_REVIEW_DEADLINE = "0000-01-01";

export function readSecurityPolicyEnforcement(
  value: string | undefined,
): SecurityPolicyEnforcement {
  if (value === undefined || value === "" || value === "enforce") {
    return "enforce";
  }
  if (value === "warn") {
    return "warn";
  }
  throw new Error(`CROCO_SECURITY_POLICY_ENFORCEMENT must be enforce or warn, received ${value}`);
}

export const GENERATED_TEMPLATE_ALLOWLISTS_POINTER = "secretScan.generatedTemplates.allowlists";

// Read from the raw metadata so each pointer index matches the file even when an earlier entry
// is malformed and dropped by the allowlist reader.
export function readGeneratedTemplateReviewDeadlines(
  metadata: unknown,
): readonly ReviewDeadlineEntry[] {
  const allowlists = recordValue(
    recordValue(recordValue(metadata, "secretScan"), "generatedTemplates"),
    "allowlists",
  );
  if (!Array.isArray(allowlists)) {
    return [];
  }
  return allowlists.map((entry) => ({
    ...stringField(entry, "reviewBy"),
    ...stringField(entry, "expiresOn"),
  }));
}

function recordValue(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)[key]
    : undefined;
}

function stringField(
  entry: unknown,
  field: "expiresOn" | "reviewBy",
): Partial<Record<"expiresOn" | "reviewBy", string>> {
  const value = recordValue(entry, field);
  return typeof value === "string" && value.trim() ? { [field]: value.trim() } : {};
}

export function findOverdueReviews(
  entries: readonly ReviewDeadlineEntry[],
  pointerPrefix: string,
  today: string,
): readonly OverdueReview[] {
  return entries.flatMap((entry, index) =>
    (["reviewBy", "expiresOn"] as const).flatMap((field) => {
      const value = entry[field];
      if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value >= today) {
        return [];
      }
      const pointer = `${pointerPrefix}[${index}].${field}`;
      return [
        {
          message: `${pointer} is stale (${value} is before ${today})`,
          recovery: `Review the exception and update ${pointer}, or remove the allowlist entry.`,
        },
      ];
    }),
  );
}

// Verification runners capture a passing check's stdout and discard it, so the job summary is
// the only place a deferred finding stays visible on the CI run.
export function reportDeferredSecurityFindings(
  check: string,
  findings: readonly string[],
  summaryPath: string | undefined = env.GITHUB_STEP_SUMMARY,
): void {
  if (findings.length === 0) {
    return;
  }
  for (const finding of findings) {
    stdout.write(`::warning title=${check} deferred to release::${finding}\n`);
  }
  if (summaryPath) {
    appendFileSync(
      summaryPath,
      [
        `### ${check}: deferred to the Release workflow`,
        "",
        "CI reports these without failing. The Release workflow and the daily Repository Policy Audit fail until they are resolved.",
        "",
        ...findings.map((finding) => `- ${finding}`),
        "",
        "",
      ].join("\n"),
    );
  }
}
