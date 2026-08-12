import { describe, expect, it } from "vitest";
import { CloudflareImagesDiagnosticsProvider } from "../libs/CloudflareImagesDiagnosticsProvider";
import { CloudflareImagesProvider } from "../libs/CloudflareImagesProvider";
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

  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "uploads through a direct-upload intent and finds the image by its caller key",
    async () => {
      const provider = new CloudflareImagesProvider(liveConfig);
      const key = `croco-live-smoke/direct-upload-${Date.now()}.png`;
      let intentRequested = false;
      let primaryFailed = false;
      let primaryError: unknown;
      let cleanupFailed = false;
      let cleanupError: unknown;

      try {
        intentRequested = true;
        const intent = await provider.getUploadIntent(key, { ttlInSeconds: 120 });
        const formData = new FormData();
        formData.append("file", new File([ONE_PIXEL_PNG], "smoke.png", { type: "image/png" }));
        const uploadResponse = await fetch(intent.uploadUrl, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = (await uploadResponse.json()) as {
          readonly result?: { readonly id?: string };
          readonly success?: boolean;
        };

        expect(uploadResponse.ok).toBe(true);
        expect(uploadPayload).toMatchObject({ success: true, result: { id: key } });

        await expect(provider.getMetadata(key)).resolves.toMatchObject({
          lastModified: expect.any(Date),
        });
      } catch (error) {
        primaryFailed = true;
        primaryError = error;
      } finally {
        if (intentRequested) {
          try {
            await provider.delete(key);
          } catch (error) {
            cleanupFailed = true;
            cleanupError = error;
          }
        }
      }

      if (primaryFailed) {
        throw primaryError;
      }
      if (cleanupFailed) {
        throw cleanupError;
      }
    },
  );
});

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
