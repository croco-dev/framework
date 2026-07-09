export const SECRET_PLACEHOLDER_POLICY_VERSION = "croco.secret-placeholder-policy/v1";

export type SecretPlaceholderEnvVar = {
  readonly name: string;
  readonly requiredForRealProvider: boolean;
  readonly secret: boolean;
  readonly description?: string;
  readonly example?: string;
};

export type SecretPlaceholderProfileManifest = {
  readonly profile: {
    readonly name: string;
  };
  readonly env: {
    readonly required: readonly SecretPlaceholderEnvVar[];
    readonly optional: readonly SecretPlaceholderEnvVar[];
  };
};

export type SecretPlaceholderArtifacts = {
  readonly envExample: string;
  readonly providerProfileDocs: string;
  readonly secretsChecklist: string;
};

export type SecretPlaceholderPolicyViolation = {
  readonly artifact: keyof SecretPlaceholderArtifacts;
  readonly code: string;
  readonly message: string;
  readonly line?: number;
};

export type GeneratedTemplateSecretAllowlistEntry = {
  readonly pathPattern: string;
  readonly matchPattern: string;
  readonly owner: string;
  readonly reason: string;
  readonly expiresOn?: string;
  readonly reviewBy?: string;
};

export type GeneratedTemplateSecretMetadataViolation = {
  readonly message: string;
  readonly recovery: string;
};

export type GeneratedTemplateSecretFinding = {
  readonly filePath: string;
  readonly line: number;
  readonly match: string;
  readonly patternId: string;
};

export class SecretPlaceholderPolicyError extends Error {
  readonly code = "CROCO_SAAS_PROFILE_SECRET_PLACEHOLDER_POLICY_FAILED";
  readonly violations: readonly SecretPlaceholderPolicyViolation[];

  constructor(violations: readonly SecretPlaceholderPolicyViolation[]) {
    super(formatSecretPlaceholderPolicyViolationMessage(violations));
    this.name = "SecretPlaceholderPolicyError";
    this.violations = violations;
  }
}

type CredentialPattern = {
  readonly id: string;
  readonly pattern: RegExp;
};

const sensitiveEnvAssignmentNames = [
  "BETTER_AUTH_SECRET",
  "CLERK_SECRET_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDINARY_URL",
  "DATABASE_URL",
  "POLAR_ACCESS_TOKEN",
  "POLAR_WEBHOOK_SECRET",
  "UPSTASH_QSTASH_CURRENT_SIGNING_KEY",
  "UPSTASH_QSTASH_NEXT_SIGNING_KEY",
  "UPSTASH_QSTASH_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
] as const;

const credentialPatterns: readonly CredentialPattern[] = [
  { id: "aws-access-key-id", pattern: /AKIA[0-9A-Z]{16}/g },
  { id: "aws-temporary-access-key-id", pattern: /ASIA[0-9A-Z]{16}/g },
  { id: "github-token", pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/g },
  { id: "openai-api-key", pattern: /sk-[A-Za-z0-9]{32,}/g },
  { id: "anthropic-api-key", pattern: /sk-ant-[A-Za-z0-9_-]{32,}/g },
  { id: "slack-token", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g },
  {
    id: "secret-env-assignment",
    pattern: new RegExp(
      `\\b(?:${sensitiveEnvAssignmentNames.join("|")})\\s*=\\s*(["']?)(?!<croco-|<secret>|$)([^\\s"']{12,})\\1`,
      "g",
    ),
  },
];

export function renderSecretPlaceholder(entry: Pick<SecretPlaceholderEnvVar, "name">): string {
  return `<croco-secret:${entry.name}>`;
}

export function renderConfigPlaceholder(entry: Pick<SecretPlaceholderEnvVar, "name">): string {
  return `<croco-config:${entry.name}>`;
}

export function renderSafeEnvExampleValue(
  entry: SecretPlaceholderEnvVar,
  profileName: string,
): string {
  if (entry.name === "SAAS_PROVIDER_PROFILE") {
    return profileName;
  }

  if (entry.example === "true" || entry.example === "false") {
    return entry.example;
  }

  return entry.secret ? renderSecretPlaceholder(entry) : renderConfigPlaceholder(entry);
}

export function renderSecretPlaceholderPolicyTable(
  manifest: SecretPlaceholderProfileManifest,
): string {
  return [
    `Policy version: \`${SECRET_PLACEHOLDER_POLICY_VERSION}\``,
    "",
    "| Env | Safe value | Kind |",
    "| --- | --- | --- |",
    ...allManifestEnv(manifest).map((entry) => {
      const kind = entry.secret ? "secret" : "config";
      const value = renderSafeEnvExampleValue(entry, manifest.profile.name);

      return `| \`${entry.name}\` | \`${value}\` | ${kind} |`;
    }),
  ].join("\n");
}

export function renderSecretsChecklistPlaceholderItems(
  manifest: SecretPlaceholderProfileManifest,
  entries: readonly SecretPlaceholderEnvVar[],
): readonly string[] {
  return entries.map((entry) => {
    const value = renderSafeEnvExampleValue(entry, manifest.profile.name);
    const description = entry.description ? ` - ${entry.description}` : "";

    return `- [ ] \`${entry.name}\` = \`${value}\`${description}`;
  });
}

export function validateSaasProviderSecretPlaceholderPolicy(
  manifest: SecretPlaceholderProfileManifest,
  artifacts: SecretPlaceholderArtifacts,
): readonly SecretPlaceholderPolicyViolation[] {
  const violations: SecretPlaceholderPolicyViolation[] = [];
  const envAssignments = parseEnvAssignments(artifacts.envExample);

  for (const entry of allManifestEnv(manifest)) {
    const expectedValue = renderSafeEnvExampleValue(entry, manifest.profile.name);
    const assignment = envAssignments.get(entry.name);

    if (!assignment) {
      violations.push({
        artifact: "envExample",
        code: "CROCO_SECRET_PLACEHOLDER_ENV_MISSING",
        message: `${entry.name} is missing from .env.example`,
      });
      continue;
    }

    if (assignment.value !== expectedValue) {
      violations.push({
        artifact: "envExample",
        code: "CROCO_SECRET_PLACEHOLDER_ENV_UNSAFE",
        line: assignment.line,
        message: `${entry.name} must use ${expectedValue}, not ${assignment.value || "<empty>"}`,
      });
    }
  }

  for (const entry of allManifestEnv(manifest)) {
    const expectedValue = renderSafeEnvExampleValue(entry, manifest.profile.name);
    if (!docContainsEntryValue(artifacts.providerProfileDocs, entry.name, expectedValue)) {
      violations.push({
        artifact: "providerProfileDocs",
        code: "CROCO_SECRET_PLACEHOLDER_PROVIDER_DOCS_MISSING",
        message: `docs/provider-profile.md must document ${entry.name} with ${expectedValue}`,
      });
    }
    if (!docContainsEntryValue(artifacts.secretsChecklist, entry.name, expectedValue)) {
      violations.push({
        artifact: "secretsChecklist",
        code: "CROCO_SECRET_PLACEHOLDER_CHECKLIST_MISSING",
        message: `docs/secrets-checklist.md must document ${entry.name} with ${expectedValue}`,
      });
    }
  }

  violations.push(
    ...scanArtifact("envExample", ".env.example", artifacts.envExample),
    ...scanArtifact(
      "providerProfileDocs",
      "docs/provider-profile.md",
      artifacts.providerProfileDocs,
    ),
    ...scanArtifact("secretsChecklist", "docs/secrets-checklist.md", artifacts.secretsChecklist),
  );

  return violations;
}

function docContainsEntryValue(doc: string, name: string, value: string): boolean {
  return doc
    .split(/\r?\n/)
    .some((line) => line.includes(`\`${name}\``) && line.includes(`\`${value}\``));
}

export function assertSaasProviderSecretPlaceholderPolicy(
  manifest: SecretPlaceholderProfileManifest,
  artifacts: SecretPlaceholderArtifacts,
): void {
  const violations = validateSaasProviderSecretPlaceholderPolicy(manifest, artifacts);

  if (violations.length === 0) {
    return;
  }

  throw new SecretPlaceholderPolicyError(violations);
}

function formatSecretPlaceholderPolicyViolationMessage(
  violations: readonly SecretPlaceholderPolicyViolation[],
): string {
  return [
    "CROCO_SAAS_PROFILE_SECRET_PLACEHOLDER_POLICY_FAILED: generated provider artifacts contain unsafe secret placeholders",
    ...violations.map((violation) => {
      const line = violation.line === undefined ? "" : `:${violation.line}`;
      return `- ${violation.code} ${violation.artifact}${line}: ${violation.message}`;
    }),
  ].join("\n");
}

export function scanGeneratedTemplateSecretText(
  filePath: string,
  text: string,
  allowlists: readonly GeneratedTemplateSecretAllowlistEntry[] = [],
): readonly GeneratedTemplateSecretFinding[] {
  const findings: GeneratedTemplateSecretFinding[] = [];

  for (const credentialPattern of credentialPatterns) {
    credentialPattern.pattern.lastIndex = 0;
    for (const match of text.matchAll(credentialPattern.pattern)) {
      const matchedText = match[0];
      const index = match.index ?? 0;
      const finding = {
        filePath,
        line: lineNumberAt(text, index),
        match: matchedText,
        patternId: credentialPattern.id,
      };

      if (!isFindingAllowlisted(finding, allowlists)) {
        findings.push(finding);
      }
    }
  }

  return findings;
}

export function readGeneratedTemplateSecretAllowlistsFromMetadata(
  metadata: unknown,
  today: string,
): {
  readonly allowlists: readonly GeneratedTemplateSecretAllowlistEntry[];
  readonly violations: readonly GeneratedTemplateSecretMetadataViolation[];
} {
  const violations: GeneratedTemplateSecretMetadataViolation[] = [];
  const root = isRecord(metadata) ? metadata : {};
  const secretScan = isRecord(root["secretScan"]) ? root["secretScan"] : {};
  const generatedTemplates = isRecord(secretScan["generatedTemplates"])
    ? secretScan["generatedTemplates"]
    : {};
  const rawAllowlists = generatedTemplates["allowlists"];

  if (rawAllowlists === undefined) {
    return { allowlists: [], violations };
  }

  if (!Array.isArray(rawAllowlists)) {
    return {
      allowlists: [],
      violations: [
        {
          message: "secretScan.generatedTemplates.allowlists must be an array",
          recovery:
            "Set secretScan.generatedTemplates.allowlists to an array of reviewed exceptions.",
        },
      ],
    };
  }

  const allowlists = rawAllowlists.flatMap((entry, index) =>
    readGeneratedTemplateSecretAllowlistEntry(
      isRecord(entry) ? entry : {},
      `secretScan.generatedTemplates.allowlists[${index}]`,
      today,
      violations,
    ),
  );

  return { allowlists, violations };
}

function readGeneratedTemplateSecretAllowlistEntry(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): readonly GeneratedTemplateSecretAllowlistEntry[] {
  const pathPattern = readRequiredMetadataString(entry, "pathPattern", pointer, violations);
  const matchPattern = readRequiredMetadataString(entry, "matchPattern", pointer, violations);
  const owner = readRequiredMetadataString(entry, "owner", pointer, violations);
  const reason = readRequiredMetadataString(entry, "reason", pointer, violations);
  const reviewDate = readReviewDate(entry, pointer, today, violations);

  validateRegex(pathPattern, `${pointer}.pathPattern`, violations);
  validateRegex(matchPattern, `${pointer}.matchPattern`, violations);
  validateGeneratedTemplateAllowlistPatternScope(pathPattern, matchPattern, pointer, violations);

  if (!pathPattern || !matchPattern || !owner || !reason) {
    return [];
  }

  return [
    {
      pathPattern,
      matchPattern,
      owner,
      reason,
      ...reviewDate,
    },
  ];
}

function scanArtifact(
  artifact: keyof SecretPlaceholderArtifacts,
  filePath: string,
  text: string,
): readonly SecretPlaceholderPolicyViolation[] {
  return scanGeneratedTemplateSecretText(filePath, text).map((finding) => ({
    artifact,
    code: "CROCO_SECRET_PLACEHOLDER_REAL_LOOKING_CREDENTIAL",
    line: finding.line,
    message: `${filePath} contains ${finding.patternId} shaped value ${finding.match}`,
  }));
}

function allManifestEnv(
  manifest: SecretPlaceholderProfileManifest,
): readonly SecretPlaceholderEnvVar[] {
  return [...manifest.env.required, ...manifest.env.optional];
}

function parseEnvAssignments(
  content: string,
): Map<string, { readonly line: number; readonly value: string }> {
  const assignments = new Map<string, { readonly line: number; readonly value: string }>();
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    assignments.set(trimmed.slice(0, separatorIndex), {
      line: index + 1,
      value: trimmed.slice(separatorIndex + 1),
    });
  });

  return assignments;
}

function isFindingAllowlisted(
  finding: GeneratedTemplateSecretFinding,
  allowlists: readonly GeneratedTemplateSecretAllowlistEntry[],
): boolean {
  return allowlists.some((entry) => {
    const pathPattern = safeRegExp(entry.pathPattern);
    const matchPattern = safeRegExp(entry.matchPattern);

    return (
      pathPattern?.test(finding.filePath) === true && matchPattern?.test(finding.match) === true
    );
  });
}

function lineNumberAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function readRequiredMetadataString(
  entry: Record<string, unknown>,
  field: string,
  pointer: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): string {
  const value = entry[field];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  violations.push({
    message: `${pointer}.${field} must be a non-empty string`,
    recovery: `Add a concrete ${field} value to ${pointer}.`,
  });
  return "";
}

function readReviewDate(
  entry: Record<string, unknown>,
  pointer: string,
  today: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): { readonly expiresOn?: string; readonly reviewBy?: string } {
  const reviewBy = typeof entry["reviewBy"] === "string" ? entry["reviewBy"].trim() : "";
  const expiresOn = typeof entry["expiresOn"] === "string" ? entry["expiresOn"].trim() : "";

  if (!reviewBy && !expiresOn) {
    violations.push({
      message: `${pointer} must include reviewBy or expiresOn`,
      recovery: `Add a YYYY-MM-DD reviewBy or expiresOn date to ${pointer}.`,
    });
    return {};
  }

  if (reviewBy) {
    validateReviewDateField(pointer, "reviewBy", reviewBy, today, violations);
  }

  if (expiresOn) {
    validateReviewDateField(pointer, "expiresOn", expiresOn, today, violations);
  }

  return {
    ...(expiresOn ? { expiresOn } : {}),
    ...(reviewBy ? { reviewBy } : {}),
  };
}

function validateReviewDateField(
  pointer: string,
  field: "expiresOn" | "reviewBy",
  value: string,
  today: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): void {
  if (!isValidCalendarDate(value)) {
    violations.push({
      message: `${pointer}.${field} must be a valid YYYY-MM-DD date`,
      recovery: `Replace ${pointer}.${field} with a valid calendar date.`,
    });
    return;
  }

  if (value < today) {
    violations.push({
      message: `${pointer}.${field} is stale (${value} is before ${today})`,
      recovery: `Review the exception and update ${pointer}.${field}, or remove the allowlist entry.`,
    });
  }
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateRegex(
  pattern: string,
  pointer: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): void {
  if (!pattern) return;
  if (safeRegExp(pattern)) return;

  violations.push({
    message: `${pointer} must be a valid and bounded regular expression`,
    recovery: `Fix ${pointer} so it compiles and avoids broad or backtracking-heavy constructs.`,
  });
}

function validateGeneratedTemplateAllowlistPatternScope(
  pathPattern: string,
  matchPattern: string,
  pointer: string,
  violations: GeneratedTemplateSecretMetadataViolation[],
): void {
  if (pathPattern && !pathPattern.includes("templates/") && !pathPattern.includes("templates\\/")) {
    violations.push({
      message: `${pointer}.pathPattern must target generated templates`,
      recovery: `Replace ${pointer}.pathPattern with a generated template path pattern such as ^packages/create-croco-app/templates/.`,
    });
  }

  if (isCatchAllRegexPattern(pathPattern)) {
    violations.push({
      message: `${pointer}.pathPattern must not be a catch-all regular expression`,
      recovery: `Narrow ${pointer}.pathPattern to the specific generated template file that needs an exception.`,
    });
  }

  if (isCatchAllRegexPattern(matchPattern)) {
    violations.push({
      message: `${pointer}.matchPattern must not be a catch-all regular expression`,
      recovery: `Narrow ${pointer}.matchPattern to the exact fixture value or assignment prefix that needs an exception.`,
    });
  }
}

function isCatchAllRegexPattern(pattern: string): boolean {
  const compactPattern = pattern.replace(/\s/g, "");
  if (
    [
      ".*",
      "^.*",
      ".*$",
      "^.*$",
      ".+",
      "^.+",
      ".+$",
      "^.+$",
      "[\\s\\S]*",
      "^[\\s\\S]*",
      "[\\s\\S]*$",
      "^[\\s\\S]*$",
    ].includes(compactPattern)
  ) {
    return true;
  }

  return [".*", ".+", "[\\s\\S]*"].some((wildcard) => compactPattern.includes(wildcard));
}

function safeRegExp(pattern: string): RegExp | null {
  if (!isGeneratedTemplateAllowlistRegexSafe(pattern)) {
    return null;
  }

  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function isGeneratedTemplateAllowlistRegexSafe(pattern: string): boolean {
  if (pattern.length > 256) {
    return false;
  }

  const compactPattern = pattern.replace(/\s/g, "");
  if (/\\[1-9]/.test(compactPattern)) {
    return false;
  }

  return !/\((?:\?:)?[^)]*[+*][^)]*\)(?:[+*]|\{\d*,?\d*\})/.test(compactPattern);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
