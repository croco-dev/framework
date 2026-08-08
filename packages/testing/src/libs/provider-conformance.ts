import { Readable } from "node:stream";
import * as assert from "node:assert/strict";
import {
  FileNotFoundProblem,
  InvalidKeyProblem,
  InvalidSignedUrlExpiryProblem,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
  type ObjectMetadata,
  type StorageProvider,
} from "@croco/storage-core";

export type StorageProviderOptionalMetadataExpectation = "required" | "optional" | "unsupported";

export type StorageProviderUrlExpectation =
  | string
  | RegExp
  | ((url: string, context: { readonly key: string; readonly providerName: string }) => void);

export type StorageProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type StorageProviderConformanceOptions = {
  readonly createProvider: () => StorageProvider | Promise<StorageProvider>;
  readonly keyPrefix?: string;
  readonly providerName: string;
  readonly metadata?: {
    readonly contentType?: StorageProviderOptionalMetadataExpectation;
    readonly customMetadata?: StorageProviderOptionalMetadataExpectation;
  };
  readonly publicUrl?: StorageProviderUrlExpectation;
  readonly signedUrl?: StorageProviderUrlExpectation;
};

export type StorageProviderConformanceSuite = {
  readonly cases: readonly StorageProviderConformanceCase[];
};

const defaultMetadataExpectations = {
  contentType: "optional",
  customMetadata: "optional",
} satisfies Required<NonNullable<StorageProviderConformanceOptions["metadata"]>>;

const INVALID_SIGNED_URL_EXPIRY_CASES = [
  -1,
  0,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  MAX_SIGNED_URL_EXPIRY_SECONDS + 1,
  Number.MAX_SAFE_INTEGER + 1,
] as const;

const INVALID_SIGNED_URL_EXPIRY_MESSAGE = `Signed URL expiry must be a positive safe integer no greater than ${MAX_SIGNED_URL_EXPIRY_SECONDS} seconds`;

export function createStorageProviderConformanceSuite(
  options: StorageProviderConformanceOptions,
): StorageProviderConformanceSuite {
  let keySequence = 0;
  const metadataExpectations = {
    ...defaultMetadataExpectations,
    ...options.metadata,
  };

  const createKey = (label: string): string => {
    keySequence += 1;
    const prefix = normalizeKeyPrefix(options.keyPrefix ?? "croco-conformance");
    return `${prefix}/${sanitizeKeySegment(options.providerName)}-${label}-${keySequence}.txt`;
  };

  const createProvider = async (): Promise<StorageProvider> => await options.createProvider();

  return {
    cases: [
      {
        name: "stores and reads buffer objects with required metadata",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("buffer");
          const data = Buffer.from("croco storage conformance buffer");

          await provider.put(key, data, {
            contentType: "text/plain",
            metadata: {
              conformance: "storage-provider",
              provider: options.providerName,
            },
          });

          assert.deepEqual(await provider.get(key), data);
          assert.equal(await provider.exists(key), true);

          const metadata = await provider.getMetadata(key);
          assertStorageMetadata(metadata, {
            data,
            expectations: metadataExpectations,
            providerName: options.providerName,
          });
        },
      },
      {
        name: "stores and streams readable objects",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("stream");
          const data = Buffer.from("croco storage conformance stream");

          await provider.put(key, Readable.from([data]), {
            contentType: "text/plain",
          });

          const stream = await provider.getStream(key);
          assert.deepEqual(await readStream(stream), data);
        },
      },
      {
        name: "deletes existing objects and reports them missing",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("delete");

          await provider.put(key, Buffer.from("delete me"));
          assert.equal(await provider.exists(key), true);

          await provider.delete(key);

          assert.equal(await provider.exists(key), false);
          await assert.rejects(() => provider.get(key), FileNotFoundProblem);
        },
      },
      {
        name: "reports missing objects with deterministic not-found behavior",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("missing");

          assert.equal(await provider.exists(key), false);
          await assert.rejects(() => provider.get(key), FileNotFoundProblem);
          await assert.rejects(() => provider.getStream(key), FileNotFoundProblem);
          await assert.rejects(() => provider.getMetadata(key), FileNotFoundProblem);
        },
      },
      {
        name: "rejects invalid storage keys consistently",
        run: async () => {
          const provider = await createProvider();
          const invalidKeys = ["", "/leading-slash", "trailing-slash/", "double//slash"];

          for (const key of invalidKeys) {
            await assert.rejects(
              () => provider.put(key, Buffer.from("invalid")),
              InvalidKeyProblem,
            );
            await assert.rejects(() => provider.get(key), InvalidKeyProblem);
            await assert.rejects(() => provider.getStream(key), InvalidKeyProblem);
            await assert.rejects(() => provider.delete(key), InvalidKeyProblem);
            await assert.rejects(() => provider.exists(key), InvalidKeyProblem);
            await assert.rejects(() => provider.getMetadata(key), InvalidKeyProblem);
            assert.throws(() => provider.getPublicUrl(key), InvalidKeyProblem);
            await assert.rejects(
              () => provider.getSignedUrl(key, { expiresIn: 60 }),
              InvalidKeyProblem,
            );
          }
        },
      },
      {
        name: "rejects invalid signed URL expiries with one provider-independent contract",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("signed-url-expiry");

          await provider.put(key, Buffer.from("signed URL expiry target"));

          for (const expiresIn of INVALID_SIGNED_URL_EXPIRY_CASES) {
            await assert.rejects(
              () => provider.getSignedUrl(key, { expiresIn }),
              (error: unknown) => {
                assert.ok(error instanceof InvalidSignedUrlExpiryProblem);
                assert.equal(error.code, "STORAGE_INVALID_SIGNED_URL_EXPIRY");
                assert.equal(error.message, INVALID_SIGNED_URL_EXPIRY_MESSAGE);
                return true;
              },
            );
          }
        },
      },
      {
        name: "creates public and signed URLs without leaking object contents",
        run: async () => {
          const provider = await createProvider();
          const key = createKey("url");

          await provider.put(key, Buffer.from("url target"));

          const publicUrl = provider.getPublicUrl(key);
          assertUrlExpectation(publicUrl, options.publicUrl, {
            key,
            providerName: options.providerName,
          });
          assert.ok(
            !publicUrl.includes("url target"),
            "Public URL must not contain object contents.",
          );

          const signedUrl = await provider.getSignedUrl(key, { expiresIn: 60 });
          assertUrlExpectation(signedUrl, options.signedUrl, {
            key,
            providerName: options.providerName,
          });
          assert.ok(
            !signedUrl.includes("url target"),
            "Signed URL must not contain object contents.",
          );
        },
      },
    ],
  };
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks);
}

function assertStorageMetadata(
  metadata: ObjectMetadata,
  options: {
    readonly data: Buffer;
    readonly expectations: Required<NonNullable<StorageProviderConformanceOptions["metadata"]>>;
    readonly providerName: string;
  },
): void {
  assert.equal(metadata.size, options.data.length);
  assert.ok(
    metadata.lastModified instanceof Date && !Number.isNaN(metadata.lastModified.getTime()),
    "Storage metadata must include a valid lastModified Date.",
  );

  assertOptionalMetadata(
    "contentType",
    metadata.contentType,
    "text/plain",
    options.expectations.contentType,
    options.providerName,
  );
  assertOptionalMetadata(
    "customMetadata",
    metadata.metadata?.conformance,
    "storage-provider",
    options.expectations.customMetadata,
    options.providerName,
  );
}

function assertOptionalMetadata(
  label: string,
  actual: string | undefined,
  expected: string,
  expectation: StorageProviderOptionalMetadataExpectation,
  providerName: string,
): void {
  if (expectation === "unsupported") {
    return;
  }

  if (expectation === "required") {
    assert.equal(actual, expected, `${providerName} must preserve ${label}.`);
    return;
  }

  if (actual !== undefined) {
    assert.equal(actual, expected, `${providerName} returned unexpected ${label}.`);
  }
}

function assertUrlExpectation(
  url: string,
  expectation: StorageProviderUrlExpectation | undefined,
  context: { readonly key: string; readonly providerName: string },
): void {
  assert.ok(url.length > 0, "Storage provider URL must be non-empty.");
  assert.ok(url.includes(context.key), "Storage provider URL must include the object key.");

  if (expectation === undefined) {
    return;
  }

  if (typeof expectation === "string") {
    assert.ok(
      url.includes(expectation),
      `Expected URL to include "${expectation}", received ${url}.`,
    );
    return;
  }

  if (expectation instanceof RegExp) {
    assert.match(url, expectation);
    return;
  }

  expectation(url, context);
}

function normalizeKeyPrefix(prefix: string): string {
  return prefix.split("/").map(sanitizeKeySegment).filter(Boolean).join("/");
}

function sanitizeKeySegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
