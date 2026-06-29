import {
  ResendMissingConfigProblem,
  ResendValidationProblem,
  type ResendConfigKey,
} from "./problems/ResendNotificationProblem";

export type ResendConfig = {
  readonly apiKey: string;
  readonly from: string;
};

export type SafeResendConfigDetails = {
  readonly provider: "resend";
  readonly hasApiKey: boolean;
  readonly hasDefaultFrom: boolean;
  readonly defaultFromDomain?: string;
  readonly missingConfig: readonly string[];
};

const RESEND_CONFIG_ENV_BY_KEY: Record<ResendConfigKey, string> = {
  apiKey: "RESEND_API_KEY",
  from: "default from address",
};

export function validateResendConfig(config: Partial<ResendConfig>): ResendConfig {
  const missingConfig = getMissingResendConfigKeys(config);

  if (missingConfig.length > 0) {
    throw new ResendMissingConfigProblem(missingConfig);
  }

  const { apiKey, from } = config;

  if (!isNonEmptyString(apiKey) || !isNonEmptyString(from)) {
    throw new ResendMissingConfigProblem(getMissingResendConfigKeys(config));
  }

  if (!isEmailLike(from)) {
    throw new ResendValidationProblem(
      {
        provider: "resend",
        operation: "configuration",
        upstreamCode: "invalid-default-from",
      },
      "Resend default sender must be an email address or name-address value",
    );
  }

  return {
    apiKey,
    from,
  };
}

export function getMissingResendConfigKeys(
  config: Partial<ResendConfig>,
): readonly ResendConfigKey[] {
  const missingConfig: ResendConfigKey[] = [];

  if (!isNonEmptyString(config.apiKey)) {
    missingConfig.push("apiKey");
  }

  if (!isNonEmptyString(config.from)) {
    missingConfig.push("from");
  }

  return missingConfig;
}

export function createSafeResendConfigDetails(
  config: Partial<ResendConfig>,
): SafeResendConfigDetails {
  const fromDomain = getEmailDomain(config.from);
  const missingConfig = getMissingResendConfigKeys(config).map(
    (key) => RESEND_CONFIG_ENV_BY_KEY[key],
  );

  return {
    provider: "resend",
    hasApiKey: isNonEmptyString(config.apiKey),
    hasDefaultFrom: isNonEmptyString(config.from),
    ...(fromDomain === undefined ? {} : { defaultFromDomain: fromDomain }),
    missingConfig,
  };
}

export function isResendEmailAddress(value: string): boolean {
  return isEmailLike(value);
}

function isEmailLike(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const address = extractAddress(value);

  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address);
}

function getEmailDomain(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const address = extractAddress(value);
  const atIndex = address.lastIndexOf("@");

  return atIndex === -1 ? undefined : address.slice(atIndex + 1).toLowerCase();
}

function extractAddress(value: string): string {
  const trimmed = value.trim();
  const nameAddress = trimmed.match(/<([^<>]+)>$/);

  return nameAddress?.[1]?.trim() ?? trimmed;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
