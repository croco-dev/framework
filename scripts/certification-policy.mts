export const certificationRequirementOrder = [
  "certified-required",
  "candidate-optional",
  "not-applicable",
] as const;

export type CertificationRequirementKey = (typeof certificationRequirementOrder)[number];

export type CertificationPolicyScope<RequiredMaturity extends string = string> = {
  readonly claimRequiresCertified: boolean;
  readonly extensionGroups: readonly string[];
  readonly requiredMaturity: RequiredMaturity;
  readonly states: Readonly<Record<CertificationRequirementKey, string>>;
};

export type CertificationPolicy<RequiredMaturity extends string = string> = {
  readonly scope: CertificationPolicyScope<RequiredMaturity>;
};

export type CertificationPolicyParseOptions<RequiredMaturity extends string> = {
  readonly catalogMetadataPath: string;
  readonly defaultRequiredMaturity: RequiredMaturity;
  readonly diagnostics: string[];
  readonly extensionGroups: readonly string[];
  readonly missingPolicyMessage?: string;
  readonly policyValue: unknown;
  readonly validRequiredMaturities: readonly RequiredMaturity[];
};

const certificationClaimPatterns: readonly RegExp[] = [
  /Croco compatible\s*:/i,
  /!\[[^\]]*\b(?:certified|certification|Croco compatible)\b[^\]]*\]/i,
  /\[[^\]]*\b(?:certified|certification|Croco compatible)\b[^\]]*\]\([^)]+\)/i,
  /\bcertified\s+(?:for|against|with)\s+(?:the\s+)?Croco\b/i,
  /\bCroco\s+certified\b/i,
];

export function createDefaultCertificationPolicy<RequiredMaturity extends string>(
  requiredMaturity: RequiredMaturity,
): CertificationPolicy<RequiredMaturity> {
  return {
    scope: {
      claimRequiresCertified: true,
      extensionGroups: [],
      requiredMaturity,
      states: {
        "certified-required": "",
        "candidate-optional": "",
        "not-applicable": "",
      },
    },
  };
}

export function parseCertificationPolicy<RequiredMaturity extends string>({
  catalogMetadataPath,
  defaultRequiredMaturity,
  diagnostics,
  extensionGroups,
  missingPolicyMessage,
  policyValue,
  validRequiredMaturities,
}: CertificationPolicyParseOptions<RequiredMaturity>): CertificationPolicy<RequiredMaturity> {
  const defaultPolicy = createDefaultCertificationPolicy(defaultRequiredMaturity);

  if (policyValue === undefined) {
    diagnostics.push(
      missingPolicyMessage ?? `${catalogMetadataPath}: certification.policy must be an object`,
    );
    return defaultPolicy;
  }

  if (!isRecord(policyValue)) {
    diagnostics.push(`${catalogMetadataPath}: certification.policy must be an object`);
    return defaultPolicy;
  }

  const scopeValue = policyValue.scope;
  if (!isRecord(scopeValue)) {
    diagnostics.push(`${catalogMetadataPath}: certification.policy.scope must be an object`);
    return defaultPolicy;
  }

  const extensionGroupValue = scopeValue.extensionGroups;
  const extensionGroupList = isStringArray(extensionGroupValue) ? extensionGroupValue : [];
  if (!isStringArray(extensionGroupValue) || extensionGroupList.length === 0) {
    diagnostics.push(
      `${catalogMetadataPath}: certification.policy.scope.extensionGroups must be a non-empty string array`,
    );
  }

  for (const group of extensionGroupList) {
    if (!extensionGroups.includes(group)) {
      diagnostics.push(
        `${catalogMetadataPath}: certification.policy.scope.extensionGroups references non-extension group ${group}`,
      );
    }
  }

  for (const group of extensionGroups) {
    if (!extensionGroupList.includes(group)) {
      diagnostics.push(
        `${catalogMetadataPath}: certification.policy.scope.extensionGroups must include extensionMatrix group ${group}`,
      );
    }
  }

  const requiredMaturity =
    typeof scopeValue.requiredMaturity === "string" &&
    validRequiredMaturities.includes(scopeValue.requiredMaturity as RequiredMaturity)
      ? (scopeValue.requiredMaturity as RequiredMaturity)
      : null;
  if (!requiredMaturity) {
    diagnostics.push(
      `${catalogMetadataPath}: certification.policy.scope.requiredMaturity must be one of ${validRequiredMaturities.join(", ")}`,
    );
  }

  if (scopeValue.claimRequiresCertified !== true) {
    diagnostics.push(
      `${catalogMetadataPath}: certification.policy.scope.claimRequiresCertified must be true`,
    );
  }

  const statesValue = scopeValue.states;
  if (!isRecord(statesValue)) {
    diagnostics.push(`${catalogMetadataPath}: certification.policy.scope.states must be an object`);
    return {
      scope: {
        claimRequiresCertified: scopeValue.claimRequiresCertified === true,
        extensionGroups: extensionGroupList,
        requiredMaturity: requiredMaturity ?? defaultRequiredMaturity,
        states: defaultPolicy.scope.states,
      },
    };
  }

  const states = Object.fromEntries(
    certificationRequirementOrder.map((requirement) => {
      const description = statesValue[requirement];
      if (typeof description !== "string" || description.trim().length === 0) {
        diagnostics.push(
          `${catalogMetadataPath}: certification.policy.scope.states.${requirement} must be a non-empty string`,
        );
        return [requirement, ""];
      }

      return [requirement, description.trim()];
    }),
  ) as Record<CertificationRequirementKey, string>;

  return {
    scope: {
      claimRequiresCertified: scopeValue.claimRequiresCertified === true,
      extensionGroups: extensionGroupList,
      requiredMaturity: requiredMaturity ?? defaultRequiredMaturity,
      states,
    },
  };
}

export function isCertificationClaimLine(line: string): boolean {
  return certificationClaimPatterns.some((pattern) => pattern.test(line));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
