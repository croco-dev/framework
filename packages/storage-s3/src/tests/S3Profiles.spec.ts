import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { createLambdaHost } from "@croco/preset-lambda";
import type { LambdaEvent, LambdaContext } from "@croco/preset-lambda";
import { createNodeHost } from "@croco/preset-node";
import { STORAGE_PROVIDER_TOKEN } from "@croco/storage-core";
import { s3Storage } from "../index";
import type { S3StorageProvider } from "../index";
import { createS3Fixture } from "./s3Fixture";

const lambdaContext: LambdaContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "local",
  functionVersion: "$LATEST",
  invokedFunctionArn: "local",
  logGroupName: "local",
  logStreamName: "local",
  memoryLimitInMB: "128",
  awsRequestId: "local",
  getRemainingTimeInMillis: () => 5000,
  done() {},
  fail() {},
  succeed() {},
};
const event: LambdaEvent = {
  version: "2.0",
  routeKey: "$default",
  rawPath: "/",
  rawQueryString: "",
  headers: {},
  isBase64Encoded: false,
  requestContext: {
    accountId: "local",
    apiId: "local",
    domainName: "lambda.local",
    domainPrefix: "local",
    requestId: "local",
    routeKey: "$default",
    stage: "$default",
    time: "",
    timeEpoch: 0,
    http: {
      method: "GET",
      path: "/",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "fixture",
    },
  },
};

describe("S3 profiles", () => {
  it("executes through Node Host and Lambda Host with app-owned disposal and session-role credentials", async () => {
    const fixture = await createS3Fixture();
    vi.stubEnv("AWS_PROFILE", undefined);
    vi.stubEnv("AWS_ACCESS_KEY_ID", "role-fixture-access");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "role-fixture-secret");
    vi.stubEnv("AWS_SESSION_TOKEN", "role-fixture-token");
    const plugin = s3Storage({
      bucket: "fixture-bucket",
      region: "ap-northeast-2",
      endpoint: fixture.endpoint,
      forcePathStyle: true,
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "s3-profile", imports: [plugin] }),
    );
    const app = {
      fetch: async () => {
        const storage = runtime.get(STORAGE_PROVIDER_TOKEN);
        await storage.put("profile.txt", new TextEncoder().encode("role-backed-local"));
        return new Response(new Uint8Array(await storage.get("profile.txt")));
      },
    };
    const host = createNodeHost(app, { port: 0, hostname: "127.0.0.1" });
    try {
      await runtime.initialize();
      const destroy = vi.spyOn(runtime.get(STORAGE_PROVIDER_TOKEN) as S3StorageProvider, "destroy");
      await host.start();
      const address = host.server?.address();
      if (!address || typeof address === "string") throw new Error("missing address");
      expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe(
        "role-backed-local",
      );
      const result = await createLambdaHost(app)(event, lambdaContext);
      expect(result.statusCode).toBe(200);
      expect(
        result.isBase64Encoded ? Buffer.from(result.body ?? "", "base64").toString() : result.body,
      ).toBe("role-backed-local");
      expect(
        fixture.requests
          .filter((r) => r.method === "PUT")
          .every((r) => r.headers["x-amz-security-token"] === "role-fixture-token"),
      ).toBe(true);
      expect(JSON.stringify(plugin.metadata)).not.toContain("role-fixture");
      await host.close();
      await runtime.dispose();
      expect(destroy).toHaveBeenCalledOnce();
    } finally {
      await host.close();
      await runtime.dispose();
      await fixture.close();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    }
  });

  it("keeps Kubernetes projected-token and Lambda role declarations scoped without embedded secrets", async () => {
    const contract = JSON.parse(
      await readFile(new URL("../../smoke/identity-contract.json", import.meta.url), "utf8"),
    );
    const pod = contract.kubernetes;
    const environment = Object.fromEntries(
      pod.spec.containers[0].env.map((e: { name: string; value: string }) => [e.name, e.value]),
    );
    const projected = pod.spec.volumes[0].projected.sources[0].serviceAccountToken;
    expect(projected.audience).toBe("sts.amazonaws.com");
    expect(environment.AWS_WEB_IDENTITY_TOKEN_FILE).toBe(
      `${pod.spec.containers[0].volumeMounts[0].mountPath}/${projected.path}`,
    );
    const condition = contract.trustPolicy.Statement[0].Condition.StringEquals;
    expect(Object.values(condition)).toContain(
      `system:serviceaccount:${pod.metadata.namespace}:${pod.spec.serviceAccountName}`,
    );
    expect(contract.objectPolicy.Statement[0].Resource).toBe(
      `arn:aws:s3:::${contract.bucket}/${contract.keyPrefix}*`,
    );
    expect(contract.objectPolicy.Statement[0].Action).toContain("s3:AbortMultipartUpload");
    expect(contract.objectPolicy.Statement[0].Action).not.toContain("s3:*");
    expect(environment.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(contract.lambda.environment.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(contract.explicitCredentialAlternative.secretRef.keys).toContain("sessionToken");
  });
});
