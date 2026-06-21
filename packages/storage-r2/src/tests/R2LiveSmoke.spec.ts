import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { R2StorageDiagnosticsProvider } from "../libs/R2StorageDiagnosticsProvider";
import type { R2Options } from "../libs/types";

const r2LiveEnv = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

const liveConfig: R2Options = {
  accountId: process.env.R2_ACCOUNT_ID ?? "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  bucket: process.env.R2_BUCKET ?? "",
  ...(process.env.R2_PUBLIC_URL_BASE ? { publicUrlBase: process.env.R2_PUBLIC_URL_BASE } : {}),
};

const missingLiveSmokeEnv = r2LiveEnv.filter((name) => !process.env[name]);

describe("R2 live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET for live R2 readiness smoke",
    async () => {
      const diagnostics = new R2StorageDiagnosticsProvider(liveConfig, {
        readinessCheck: async ({ config, signal }) => {
          const client = new S3Client({
            region: "auto",
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          });

          await client.send(
            new HeadBucketCommand({
              Bucket: config.bucket,
            }),
            {
              abortSignal: signal,
            },
          );

          return {
            details: {
              bucketReachable: true,
            },
          };
        },
      });

      const health = await diagnostics.getHealth();

      expect(health).toMatchObject({
        status: "healthy",
        component: "storage-r2",
        details: expect.objectContaining({
          liveCheck: "passed",
          readiness: {
            bucketReachable: true,
          },
        }),
      });
    },
  );
});
