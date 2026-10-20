import { defineCrocoModule, defineCrocoPlugin } from "@croco/framework-module";
import type { PluginFactory } from "@croco/framework-module";
import { STORAGE_PROVIDER_TOKEN } from "@croco/storage-core";
import { S3StorageProvider } from "./S3StorageProvider";
import type { S3StorageOptions } from "./types";

export const S3_STORAGE_MODULE_NAME = "@croco/storage-s3/provider";

/** Application-owned SDK client; no import-time registration or credential resolution. */
export const s3Storage: PluginFactory<S3StorageOptions> = (options) =>
  defineCrocoPlugin({
    metadata: {
      name: "s3-storage",
      packageName: "@croco/storage-s3",
      maturity: "alpha",
      providedContracts: ["@croco/storage-core/StorageProvider"],
      capabilities: [{ id: "storage.provider", kind: "single" }],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "S3_BUCKET",
          required: true,
          description: "Application-owned bucket with scoped IAM access.",
        },
        { key: "AWS_REGION", required: true },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/storage-s3 test",
          reference: "packages/storage-s3/src/tests/S3StorageProvider.spec.ts",
        },
      ],
      examples: ["packages/storage-s3/README.md"],
    },
    modules: [
      defineCrocoModule({
        name: S3_STORAGE_MODULE_NAME,
        providers: [
          { provide: STORAGE_PROVIDER_TOKEN, useFactory: () => new S3StorageProvider(options) },
        ],
        exports: [STORAGE_PROVIDER_TOKEN],
      }),
    ],
  });
