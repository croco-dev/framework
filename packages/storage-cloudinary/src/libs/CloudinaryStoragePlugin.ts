import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
  type PluginFactory,
} from "@croco/framework-module";
import { STORAGE_PROVIDER_TOKEN } from "@croco/storage-core";
import {
  CloudinaryDiagnosticsProvider,
  type CloudinaryDiagnosticsOptions,
} from "./CloudinaryDiagnosticsProvider";
import { CloudinaryProvider } from "./CloudinaryProvider";
import type { CloudinaryConfig } from "./types";

export const CLOUDINARY_STORAGE_MODULE_NAME = "@croco/storage-cloudinary/provider";
const CLOUDINARY_DIAGNOSTICS_CONTRIBUTION_ID = "@croco/storage-cloudinary";

export type CloudinaryStoragePluginOptions = CloudinaryConfig & {
  readonly diagnostics?: CloudinaryDiagnosticsOptions;
};

export const cloudinaryStorage: PluginFactory<CloudinaryStoragePluginOptions> = (options) => {
  const { diagnostics, ...config } = options;
  const provider = new CloudinaryProvider(config);
  const diagnosticsProvider = new CloudinaryDiagnosticsProvider(config, diagnostics);

  return defineCrocoPlugin({
    metadata: {
      name: "cloudinary-storage",
      packageName: "@croco/storage-cloudinary",
      maturity: "production",
      providedContracts: [
        "@croco/storage-core/StorageProvider",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "storage.provider", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "CLOUDINARY_URL",
          required: true,
          sensitive: true,
          description:
            "Standard Cloudinary URL parsed by the application into cloudName, apiKey, and apiSecret options.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/storage-cloudinary test",
          reference: "packages/storage-cloudinary/src/tests/CloudinaryStoragePlugin.spec.ts",
        },
      ],
      examples: ["packages/storage-cloudinary/README.md#application-plugin"],
    },
    modules: [
      defineCrocoModule({
        name: CLOUDINARY_STORAGE_MODULE_NAME,
        providers: [{ provide: STORAGE_PROVIDER_TOKEN, useValue: provider }],
        exports: [STORAGE_PROVIDER_TOKEN],
        contributions: [
          {
            id: CLOUDINARY_DIAGNOSTICS_CONTRIBUTION_ID,
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            order: 100,
            value: diagnosticsProvider satisfies DiagnosticsProvider,
          },
        ],
      }),
    ],
  });
};
