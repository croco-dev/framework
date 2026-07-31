import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin from "../index.ts";

type OxlintConfig = {
  readonly rules?: Readonly<Record<string, unknown>>;
  readonly overrides?: readonly OxlintConfig[];
};

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("oxlint rules plugin", () => {
  it("exports the rule modules", () => {
    expect(plugin).toHaveProperty("rules");
    expect(Object.keys(plugin.rules)).toHaveLength(4);

    for (const rule of Object.values(plugin.rules)) {
      expect(rule).toHaveProperty("meta");
      expect(rule).toHaveProperty("create");
    }
  });

  it("resolves every configured rule name", () => {
    const configured = readRepositoryConfig();
    const configuredRuleNames = [...collectRuleNames(configured)];
    const printed = JSON.parse(
      execFileSync(
        resolve(REPOSITORY_ROOT, "node_modules/.bin/oxlint"),
        [
          ...configuredRuleNames.flatMap((ruleName) => ["--deny", ruleName]),
          "--print-config",
          "packages/oxlint-rules/src/index.ts",
        ],
        { cwd: REPOSITORY_ROOT, encoding: "utf8" },
      ),
    ) as OxlintConfig;
    const resolvedRuleNames = collectRuleNames(printed);
    const unresolvedRuleNames = configuredRuleNames
      .filter((ruleName) => !resolvedRuleNames.has(ruleName))
      .sort();

    expect(unresolvedRuleNames).toEqual([]);
  });

  it("enables every exported custom rule on at least one lint surface", () => {
    const configured = readRepositoryConfig();
    const disabledRuleNames = Object.keys(plugin.rules)
      .map((ruleName) => `@croco/oxlint-rules/${ruleName}`)
      .filter((ruleName) => !hasEnabledRule(configured, ruleName));

    expect(disabledRuleNames).toEqual([]);
  });
});

function readRepositoryConfig(): OxlintConfig {
  return JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, ".oxlintrc.json"), "utf8"),
  ) as OxlintConfig;
}

function collectRuleNames(config: OxlintConfig): Set<string> {
  const ruleNames = new Set(Object.keys(config.rules ?? {}));

  for (const override of config.overrides ?? []) {
    for (const ruleName of collectRuleNames(override)) {
      ruleNames.add(ruleName);
    }
  }

  return ruleNames;
}

function hasEnabledRule(config: OxlintConfig, ruleName: string): boolean {
  const configuredValue = config.rules?.[ruleName];
  const severity = Array.isArray(configuredValue) ? configuredValue[0] : configuredValue;

  if (severity !== undefined && severity !== "off" && severity !== "allow" && severity !== 0) {
    return true;
  }

  return (config.overrides ?? []).some((override) => hasEnabledRule(override, ruleName));
}
