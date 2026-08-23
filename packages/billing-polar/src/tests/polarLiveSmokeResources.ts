export const POLAR_LIVE_SMOKE_RESOURCE_GROUPS = {
  readiness: ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET", "POLAR_ORGANIZATION_ID"],
  mapping: ["POLAR_ACCESS_TOKEN", "POLAR_PRODUCT_ID", "POLAR_PRICE_IDS"],
  usage: [
    "POLAR_ACCESS_TOKEN",
    "POLAR_WEBHOOK_SECRET",
    "POLAR_USAGE_EXTERNAL_CUSTOMER_ID",
    "POLAR_USAGE_EVENT_NAME",
    "POLAR_USAGE_EVENT_ID",
    "POLAR_USAGE_METER_ID",
  ],
} as const;

export type PolarLiveSmokeResource =
  (typeof POLAR_LIVE_SMOKE_RESOURCE_GROUPS)[keyof typeof POLAR_LIVE_SMOKE_RESOURCE_GROUPS][number];

export function findMissingPolarLiveSmokeResources(
  required: readonly PolarLiveSmokeResource[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PolarLiveSmokeResource[] {
  return required.filter((name) => !environment[name]);
}
