import { MissingR2ConfigProblem } from "./problems/MissingR2ConfigProblem";
import type { R2Options } from "./types";

export const R2_REQUIRED_CONFIG_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

export type R2RequiredConfigKey = (typeof R2_REQUIRED_CONFIG_KEYS)[number];

const R2_CONFIG_FIELDS = {
  R2_ACCOUNT_ID: "accountId",
  R2_ACCESS_KEY_ID: "accessKeyId",
  R2_SECRET_ACCESS_KEY: "secretAccessKey",
  R2_BUCKET: "bucket",
} as const satisfies Record<R2RequiredConfigKey, keyof R2Options>;

export function getMissingR2ConfigKeys(config: Partial<R2Options>): readonly R2RequiredConfigKey[] {
  return R2_REQUIRED_CONFIG_KEYS.filter((key) => !isNonEmptyString(config[R2_CONFIG_FIELDS[key]]));
}

export function validateR2Options(config: Partial<R2Options>): R2Options {
  const missingConfig = getMissingR2ConfigKeys(config);

  if (missingConfig.length > 0) {
    throw new MissingR2ConfigProblem(missingConfig);
  }

  return {
    accountId: config.accountId as string,
    accessKeyId: config.accessKeyId as string,
    secretAccessKey: config.secretAccessKey as string,
    bucket: config.bucket as string,
    ...(isNonEmptyString(config.publicUrlBase) ? { publicUrlBase: config.publicUrlBase } : {}),
  };
}

export function createSafeR2ConfigDetails(config: Partial<R2Options>): Record<string, unknown> {
  return {
    provider: "cloudflare-r2",
    hasAccountId: isNonEmptyString(config.accountId),
    hasAccessKeyId: isNonEmptyString(config.accessKeyId),
    hasSecretAccessKey: isNonEmptyString(config.secretAccessKey),
    hasBucket: isNonEmptyString(config.bucket),
    hasPublicUrlBase: isNonEmptyString(config.publicUrlBase),
    missingConfig: getMissingR2ConfigKeys(config),
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
