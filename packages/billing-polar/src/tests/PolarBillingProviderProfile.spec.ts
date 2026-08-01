import { describe, expect, it } from "vitest";
import { POLAR_BILLING_PROVIDER_PROFILE } from "../index";

describe("POLAR_BILLING_PROVIDER_PROFILE", () => {
  it("publishes checkout support and explicit usage and licensed-quantity capability gaps", () => {
    expect(POLAR_BILLING_PROVIDER_PROFILE).toEqual({
      providerName: "polar",
      capabilities: {
        checkout: { supported: true },
        "licensed-quantity": {
          supported: false,
          reason: "Polar licensed quantity updates are not implemented by this package.",
        },
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
