import { describe, expect, it } from "vitest";

import {
  getApplicationIntentProviderPackage,
  getApplicationIntentQualityGateEvidence,
  getApplicationIntentRuntimePackage,
} from "../libs/applicationIntentEvidence.js";

describe("ApplicationIntentEvidence", () => {
  it("maps runtime and provider intent to package evidence", () => {
    expect(getApplicationIntentRuntimePackage("cloudflare-workers")).toBe(
      "@croco/transports-cloudflare-workers",
    );
    expect(getApplicationIntentProviderPackage("meta-vite", "@test", "worker")).toBe(
      "@croco/meta-vite",
    );
    expect(getApplicationIntentProviderPackage("in-memory-events", "@test", "saas-api")).toBe(
      "@croco/events-core",
    );
    expect(
      getApplicationIntentProviderPackage("in-memory-events", "@test", "spa-backend-split"),
    ).toBe("@croco/events-inmemory");
    expect(
      getApplicationIntentProviderPackage("generated-rpc-client", "@test", "internal-tool"),
    ).toBe("@test/provider-rpc");
  });

  it("maps root and workspace quality gates to their observable scripts", () => {
    expect(getApplicationIntentQualityGateEvidence("build")).toEqual({
      kind: "root-script",
      script: "build",
    });
    expect(getApplicationIntentQualityGateEvidence("ssr-worker:presentation:smoke")).toEqual({
      kind: "workspace-script",
      packageNameSuffix: "/ssr-worker",
      script: "presentation:smoke",
    });
  });
});
