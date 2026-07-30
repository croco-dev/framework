import { describe, expect, it } from "vitest";
import { POLAR_BILLING_PROVIDER_PROFILE } from "../index";

describe("POLAR_BILLING_PROVIDER_PROFILE", () => {
  it("publishes checkout support and an explicit usage capability gap", () => {
    expect(POLAR_BILLING_PROVIDER_PROFILE).toEqual({
      providerName: "polar",
      capabilities: {
        checkout: { supported: true },
        usage: {
          supported: false,
          reason: "Polar usage delivery is not implemented by this package.",
        },
      },
    });
    expect(Object.isFrozen(POLAR_BILLING_PROVIDER_PROFILE)).toBe(true);
    expect(Object.isFrozen(POLAR_BILLING_PROVIDER_PROFILE.capabilities)).toBe(true);
  });
});
