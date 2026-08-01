export type TextReplacement = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

export type FileFinding = {
  readonly code: string;
  readonly ruleId: string;
  readonly title: string;
  readonly confidence: "safe" | "manual";
  readonly action: "rewrite" | "confirm";
  readonly message: string;
  readonly index: number;
  readonly suggestedReplacement?: TextReplacement;
};

export type UpgradeRuleResult = {
  readonly findings: readonly FileFinding[];
  readonly replacements: readonly TextReplacement[];
};

export type UpgradeRule = {
  readonly id: string;
  analyze(content: string): UpgradeRuleResult;
};

export type UpgradeRuleAnalysis = {
  readonly findings: readonly FileFinding[];
  readonly updatedContent: string;
};

const LEGACY_HTTP_SECURITY_CODE = "transports-http/security-middleware-validation";
const CURRENT_HTTP_SECURITY_CODE = "CROCO_HTTP_SECURITY_001";

const UPGRADE_FINDING_CODES = {
  metaViteRouteConfig: "CROCO_CLI_UPGRADE_001",
  unsupportedRouteConfig: "CROCO_CLI_UPGRADE_002",
  legacyHttpSecurityCode: "CROCO_CLI_UPGRADE_003",
  unsafeSecurityValidation: "CROCO_CLI_UPGRADE_004",
  legacyHttpSecurityCompatibilityString: "CROCO_CLI_UPGRADE_005",
} as const;

export const routeConfigUpgradeRule: UpgradeRule = {
  id: "route-config",
  analyze(content) {
    const routeMigration = findMetaViteRouteConfigMigration(content);

    if (routeMigration) {
      return {
        findings: [
          {
            code: UPGRADE_FINDING_CODES.metaViteRouteConfig,
            ruleId: "meta-vite-route-config",
            title: "Legacy SPA routeConfig has a meta-vite migration suggestion",
            confidence: "manual",
            action: "confirm",
            message:
              "Generated SPA routeConfig shape matched the known Croco template, but changing route runtime semantics requires confirmation before rewriting it to @croco/meta-vite defineRoute output.",
            index: routeMigration.index,
            suggestedReplacement: routeMigration.replacement,
          },
        ],
        replacements: [],
      };
    }

    const unsupportedRouteConfig = content.search(/\bexport\s+const\s+routeConfig\b/);

    return {
      findings:
        unsupportedRouteConfig >= 0
          ? [
              {
                code: UPGRADE_FINDING_CODES.unsupportedRouteConfig,
                ruleId: "unsupported-route-config",
                title: "Route config requires manual migration",
                confidence: "manual",
                action: "confirm",
                message:
                  "routeConfig was found, but its shape does not match the generated Croco SPA template. Review the route contract before rewriting it.",
                index: unsupportedRouteConfig,
              },
            ]
          : [],
      replacements: [],
    };
  },
};

export const legacyHttpSecurityUpgradeRule: UpgradeRule = {
  id: "legacy-http-security",
  analyze(content) {
    const matches = findLegacyHttpSecurityCodeMatches(content);
    const safeMatches = matches.filter((match) => match.safe);
    const manualMatches = matches.filter((match) => !match.safe);
    const findings: FileFinding[] = [];

    if (safeMatches.length > 0) {
      findings.push({
        code: UPGRADE_FINDING_CODES.legacyHttpSecurityCode,
        ruleId: "legacy-http-security-diagnostic-code",
        title: "Legacy HTTP security diagnostic code can migrate",
        confidence: "safe",
        action: "rewrite",
        message:
          "Problem.code matchers for transports-http/security-middleware-validation can be rewritten to CROCO_HTTP_SECURITY_001 while legacyCode remains available for rollout compatibility.",
        index: safeMatches[0]?.index ?? 0,
      });
    }

    for (const match of manualMatches) {
      findings.push({
        code: UPGRADE_FINDING_CODES.legacyHttpSecurityCompatibilityString,
        ruleId: "legacy-http-security-compatibility-string",
        title: "Legacy HTTP security compatibility string needs confirmation",
        confidence: "manual",
        action: "confirm",
        message:
          "A transports-http/security-middleware-validation string was found outside a Problem.code matcher. The migration assistant leaves it unchanged because legacyCode compatibility, fixtures, and documentation references can intentionally keep the legacy value.",
        index: match.index,
      });
    }

    return {
      findings,
      replacements: safeMatches.map((match) => ({
        start: match.index,
        end: match.index + match.text.length,
        text: `${match.quote}${CURRENT_HTTP_SECURITY_CODE}${match.quote}`,
      })),
    };
  },
};

export const unsafeSecurityValidationRule: UpgradeRule = {
  id: "unsafe-security-validation",
  analyze(content) {
    const index = content.search(
      /\b(?:unsafeSkipSecurityValidation\s*:\s*true|securityValidation\s*:\s*(['"])off\1)/,
    );

    return {
      findings:
        index >= 0
          ? [
              {
                code: UPGRADE_FINDING_CODES.unsafeSecurityValidation,
                ruleId: "unsafe-security-validation",
                title: "Security validation opt-out needs confirmation",
                confidence: "manual",
                action: "confirm",
                message:
                  "Security validation is disabled. The migration assistant leaves this unchanged because production intent, middleware coverage, and local fixture scope must be confirmed first.",
                index,
              },
            ]
          : [],
      replacements: [],
    };
  },
};

export const upgradeRules: readonly UpgradeRule[] = [
  routeConfigUpgradeRule,
  legacyHttpSecurityUpgradeRule,
  unsafeSecurityValidationRule,
];

export function applyUpgradeRules(
  content: string,
  rules: readonly UpgradeRule[] = upgradeRules,
): UpgradeRuleAnalysis {
  const results = rules.map((rule) => rule.analyze(content));
  const findings = results.flatMap((result) => result.findings);
  const replacements = results.flatMap((result) => result.replacements);

  return {
    findings,
    updatedContent: applyReplacements(content, replacements),
  };
}

export function applyReplacements(
  content: string,
  replacements: readonly TextReplacement[],
): string {
  if (replacements.length === 0) {
    return content;
  }

  const ordered = [...replacements].sort((first, second) => first.start - second.start);

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];

    if (previous && current && previous.end > current.start) {
      throw new Error("Upgrade codemod replacements overlap.");
    }
  }

  let updated = content;

  for (const replacement of ordered.reverse()) {
    updated = `${updated.slice(0, replacement.start)}${replacement.text}${updated.slice(replacement.end)}`;
  }

  return updated;
}

type LegacyHttpSecurityCodeMatch = {
  readonly index: number;
  readonly text: string;
  readonly quote: string;
  readonly safe: boolean;
};

function findLegacyHttpSecurityCodeMatches(
  content: string,
): readonly LegacyHttpSecurityCodeMatch[] {
  const pattern = new RegExp(`(['"])${LEGACY_HTTP_SECURITY_CODE}\\1`, "g");

  return [...content.matchAll(pattern)].flatMap((match) => {
    if (typeof match.index !== "number") {
      return [];
    }

    return [
      {
        index: match.index,
        text: match[0],
        quote: match[1] ?? "'",
        safe: isProblemCodeComparison(content, match.index, match[0].length),
      },
    ];
  });
}

function isProblemCodeComparison(content: string, index: number, length: number): boolean {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const lineEndIndex = content.indexOf("\n", index + length);
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
  const before = content.slice(lineStart, index);
  const after = content.slice(index + length, lineEnd);
  const codeAccess = String.raw`(?:^|[^A-Za-z0-9_$])(?:[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*\??\.)?code`;
  const codeBeforeLiteral = new RegExp(`${codeAccess}\\s*(?:===|!==|==|!=)\\s*$`);
  const codeAfterLiteral = new RegExp(
    `^\\s*(?:===|!==|==|!=)\\s*(?:[A-Za-z_$][\\w$]*(?:\\??\\.[A-Za-z_$][\\w$]*)*\\??\\.)?code(?:[^A-Za-z0-9_$]|$)`,
  );

  return codeBeforeLiteral.test(before) || codeAfterLiteral.test(after);
}

function findMetaViteRouteConfigMigration(
  content: string,
): { readonly index: number; readonly replacement: TextReplacement } | null {
  const routeConfigPattern =
    /import\s+([A-Za-z_$][\w$]*)\s+from\s+(['"])\.\/Page\2;\s*\n\s*export\s+const\s+routeConfig\s*=\s*\{\s*\n\s*path:\s*(['"])([^'"]+)\3,\s*\n\s*Component:\s*([A-Za-z_$][\w$]*),\s*\n\s*\};/m;
  const match = routeConfigPattern.exec(content);
  const componentName = match?.[1];
  const routePath = match?.[4];
  const componentRef = match?.[5];

  if (!match || !componentName || !routePath || componentName !== componentRef) {
    return null;
  }

  const replacementText = `import { defineRoute, type PageRouteDefinition } from '@croco/meta-vite';
import ${componentName} from './Page';

const route = {
  path: '${routePath}',
  mode: 'ssr',
  component: ${componentName},
} satisfies PageRouteDefinition;

export default defineRoute(route);`;

  return {
    index: match.index,
    replacement: {
      start: match.index,
      end: match.index + match[0].length,
      text: replacementText,
    },
  };
}
