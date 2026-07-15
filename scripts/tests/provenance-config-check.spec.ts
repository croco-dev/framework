import { describe, expect, it } from "vitest";

import { assertProvenanceConfig } from "../provenance-config-check.mts";

describe("provenance config validator", () => {
  it("rejects a missing inherited uppercase environment value", () => {
    expect(() => assertProvenanceConfig({ envValue: undefined, npmValue: "true" })).toThrow(
      "NPM_CONFIG_PROVENANCE must be inherited",
    );
  });

  it("rejects false environment or npm resolution", () => {
    expect(() => assertProvenanceConfig({ envValue: "false", npmValue: "false" })).toThrow(
      "NPM_CONFIG_PROVENANCE must be inherited",
    );
    expect(() => assertProvenanceConfig({ envValue: "true", npmValue: "false" })).toThrow(
      "npm config get provenance must resolve to true",
    );
  });

  it("accepts inherited uppercase configuration when npm resolves it", () => {
    expect(() => assertProvenanceConfig({ envValue: "true", npmValue: "true" })).not.toThrow();
  });
});
