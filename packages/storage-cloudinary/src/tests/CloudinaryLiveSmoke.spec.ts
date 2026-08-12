import { randomUUID } from "node:crypto";
import { FileNotFoundProblem } from "@croco/storage-core";
import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it, vi } from "vitest";
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

      await runLifecycleSmoke({
        cleanup: async () => await reconstructedProvider.delete(key),
        upload: async () => await uploader.put(key, image, { contentType: "image/png" }),
        verifyDeleted: async () => {
          await expect(reconstructedProvider.getMetadata(key)).rejects.toThrow(FileNotFoundProblem);
        },
        verifyUploaded: async () => {
          await expect(reconstructedProvider.get(key)).resolves.toSatisfy(
            (value: Buffer) => value.length > 0,
          );
          await expect(reconstructedProvider.exists(key)).resolves.toBe(true);
          await expect(reconstructedProvider.getMetadata(key)).resolves.toMatchObject({
            size: expect.any(Number),
          });
        },
      });
    },
  );
});

describe("Cloudinary live smoke cleanup", () => {
  it("cleans up a remotely persisted image when upload completion rejects", async () => {
    const uploadError = new Error("upload response lost");
    const cleanup = vi.fn().mockResolvedValue(undefined);

    await expect(
      runLifecycleSmoke({
        cleanup,
        upload: vi.fn().mockRejectedValue(uploadError),
        verifyDeleted: vi.fn(),
        verifyUploaded: vi.fn(),
      }),
    ).rejects.toBe(uploadError);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("preserves the upload failure when cleanup also fails", async () => {
    const uploadError = new Error("upload response lost");
    const cleanupError = new Error("cleanup failed");
    const cleanup = vi.fn().mockRejectedValue(cleanupError);

    const result = runLifecycleSmoke({
      cleanup,
      upload: vi.fn().mockRejectedValue(uploadError),
      verifyDeleted: vi.fn(),
      verifyUploaded: vi.fn(),
    });

    await expect(result).rejects.toMatchObject({
      cleanupError,
      message: uploadError.message,
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

type LifecycleSmokeSteps = {
  readonly cleanup: () => Promise<void>;
  readonly upload: () => Promise<unknown>;
  readonly verifyDeleted: () => Promise<void>;
  readonly verifyUploaded: () => Promise<void>;
};

async function runLifecycleSmoke(steps: LifecycleSmokeSteps): Promise<void> {
  let primaryFailed = false;
  let primaryError: unknown;
  let cleanupFailed = false;
  let cleanupError: unknown;

  try {
    await steps.upload();
    await steps.verifyUploaded();
  } catch (error) {
    primaryFailed = true;
    primaryError = error;
  } finally {
    try {
      await steps.cleanup();
    } catch (error) {
      cleanupFailed = true;
      cleanupError = error;
    }
  }

  if (primaryFailed && cleanupFailed) {
    throw attachCleanupError(primaryError, cleanupError);
  }
  if (primaryFailed) throw primaryError;
  if (cleanupFailed) throw cleanupError;
  await steps.verifyDeleted();
}

function attachCleanupError(primaryError: unknown, cleanupError: unknown): Error {
  if (primaryError instanceof Error) {
    Object.defineProperty(primaryError, "cleanupError", {
      configurable: true,
      value: cleanupError,
    });
    return primaryError;
  }
  return Object.assign(new Error(String(primaryError)), { cleanupError });
}

function isTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
