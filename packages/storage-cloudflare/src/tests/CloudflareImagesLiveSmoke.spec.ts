import { describe, expect, it } from "vitest";
import { CloudflareImagesDiagnosticsProvider } from "../libs/CloudflareImagesDiagnosticsProvider";
import type { CloudflareImagesOptions } from "../libs/types";

const CLOUDFLARE_IMAGES_LIVE_ENV = [
  "CROCO_LIVE_CLOUDFLARE_IMAGES",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_HASH",
] as const;

const liveConfig: CloudflareImagesOptions = {
  accountHash: process.env.CLOUDFLARE_ACCOUNT_HASH ?? "",
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
};

const missingLiveSmokeEnv = [
  ...(!isTruthyEnv("CROCO_LIVE_CLOUDFLARE_IMAGES") ? ["CROCO_LIVE_CLOUDFLARE_IMAGES"] : []),
  ...CLOUDFLARE_IMAGES_LIVE_ENV.filter(
    (name) => name !== "CROCO_LIVE_CLOUDFLARE_IMAGES" && !process.env[name],
  ),
];

describe("Cloudflare Images live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires CROCO_LIVE_CLOUDFLARE_IMAGES and Cloudflare Images credentials for live readiness smoke",
    async () => {
      const provider = new CloudflareImagesDiagnosticsProvider(liveConfig, {
        readinessCheck: async ({ config, signal }) => {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1?per_page=1`,
            {
              headers: {
                Authorization: `Bearer ${config.apiToken}`,
              },
              signal,
            },
          );

          if (!response.ok) {
            throw Object.assign(new Error(`Cloudflare Images readiness HTTP ${response.status}`), {
              status: response.status,
            });
          }

          const payload = (await response.json()) as {
            readonly result_info?: {
              readonly count?: number;
            };
            readonly success?: boolean;
          };

          if (payload.success === false) {
            throw Object.assign(new Error("Cloudflare Images readiness failed"), {
              code: "validation-failed",
            });
          }

          return {
            details: {
              accountId: config.accountId,
              imageCount: payload.result_info?.count ?? 0,
            },
          };
        },
      });

      const health = await provider.getHealth();

      expect(health).toMatchObject({
        status: "healthy",
        component: "storage-cloudflare",
        details: expect.objectContaining({
          liveCheck: "passed",
        }),
      });
    },
  );
});

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
