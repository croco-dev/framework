import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it } from "vitest";
import { CloudinaryDiagnosticsProvider } from "../libs/CloudinaryDiagnosticsProvider";
import type { CloudinaryConfig } from "../libs/types";

const CLOUDINARY_LIVE_ENV = [
  "CROCO_LIVE_CLOUDINARY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const liveConfig: CloudinaryConfig = {
  apiKey: process.env.CLOUDINARY_API_KEY ?? "",
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  secure: true,
};

const missingLiveSmokeEnv = [
  ...(!isTruthyEnv("CROCO_LIVE_CLOUDINARY") ? ["CROCO_LIVE_CLOUDINARY"] : []),
  ...CLOUDINARY_LIVE_ENV.filter((name) => name !== "CROCO_LIVE_CLOUDINARY" && !process.env[name]),
];

describe("Cloudinary live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires CROCO_LIVE_CLOUDINARY and Cloudinary credentials for live readiness smoke",
    async () => {
      const provider = new CloudinaryDiagnosticsProvider(liveConfig, {
        readinessCheck: async ({ config }) => {
          const response = await cloudinary.api.config({
            api_key: config.apiKey,
            api_secret: config.apiSecret,
            cloud_name: config.cloudName,
            secure: config.secure,
            settings: false,
          });

          return {
            details: {
              cloudName: response.cloud_name ?? config.cloudName,
            },
          };
        },
      });

      const health = await provider.getHealth();

      expect(health).toMatchObject({
        status: "healthy",
        component: "storage-cloudinary",
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
