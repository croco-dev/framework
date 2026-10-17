import { describe, expect, it } from "vitest";
import {
  parseAcquisitionContext,
  resolveAcquisitionDestination,
} from "@croco/analytics-core/acquisition";
import { origin, urls } from "../config";
describe("standalone acquisition configuration", () => {
  it("keeps registered destinations same-site and strips private URL data", () => {
    expect(resolveAcquisitionDestination("home", urls)).toBe(`${origin}/`);
    expect(
      parseAcquisitionContext(
        { url: `${origin}/?utm_source=newsletter&token=secret#email`, referrerAvailable: true },
        urls,
      ),
    ).toEqual({
      landingRef: "home",
      campaign: { utm_source: "newsletter" },
      referrer: { status: "absent" },
    });
  });
});
