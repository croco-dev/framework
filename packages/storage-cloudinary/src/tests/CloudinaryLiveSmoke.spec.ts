import { randomUUID } from "node:crypto";
import { FileNotFoundProblem } from "@croco/storage-core";
import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it } from "vitest";
import { CloudinaryDiagnosticsProvider } from "../libs/CloudinaryDiagnosticsProvider";
import { CloudinaryProvider } from "../libs/CloudinaryProvider";
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

  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "uploads a client multipart request with the requested storage key",
    async () => {
      const provider = new CloudinaryProvider(liveConfig);
      const key = `croco-live/direct-upload-${Date.now()}`;
      const intent = await provider.getUploadIntent(key, { ttlInSeconds: 300 });
      const form = new FormData();

      for (const [name, value] of Object.entries(intent.fields ?? {})) {
        form.append(name, value);
      }
      form.append(
        "file",
        new Blob(
          [
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
              "base64",
            ),
          ],
          { type: "image/png" },
        ),
        "direct-upload.png",
      );

      try {
        const response = await fetch(intent.uploadUrl, { body: form, method: "POST" });
        const payload = (await response.json()) as {
          readonly error?: { readonly message?: string };
          readonly public_id?: string;
        };

        expect(response.ok, payload.error?.message).toBe(true);
        expect(payload.public_id).toBe(key);

        const deliveryResponse = await fetch(intent.publicUrl);
        expect(deliveryResponse.ok).toBe(true);
      } finally {
        await provider.delete(key);
      }
    },
  );

  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "preserves the image lifecycle across provider reconstruction",
    async () => {
      const key = `croco-live-smoke/${randomUUID()}`;
      const image = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7WkAAAAASUVORK5CYII=",
        "base64",
      );
      const uploader = new CloudinaryProvider(liveConfig);
      const reconstructedProvider = new CloudinaryProvider(liveConfig);
      let uploaded = false;

      try {
        await uploader.put(key, image, { contentType: "image/png" });
        uploaded = true;

        await expect(reconstructedProvider.get(key)).resolves.toSatisfy(
          (value: Buffer) => value.length > 0,
        );
        await expect(reconstructedProvider.exists(key)).resolves.toBe(true);
        await expect(reconstructedProvider.getMetadata(key)).resolves.toMatchObject({
          size: expect.any(Number),
        });
      } finally {
        if (uploaded) {
          await reconstructedProvider.delete(key);
        }
      }

      await expect(reconstructedProvider.getMetadata(key)).rejects.toThrow(FileNotFoundProblem);
    },
  );
});

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
