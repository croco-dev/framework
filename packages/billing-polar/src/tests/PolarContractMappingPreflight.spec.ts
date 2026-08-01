import { describe, expect, it, vi } from "vitest";
import { inspectPolarContractMappingDrift } from "../libs/PolarContractMappingPreflight";

describe("inspectPolarContractMappingDrift", () => {
  it("compares graph-derived mappings through a read-only provider seam", async () => {
    const inputs = [
      {
        planVersionRef: "pro@1",
        productId: "product-pro",
        priceIds: ["price-monthly", "price-overage"],
        meterBindings: [{ meterId: "meter-api" }],
      },
    ] as const;
    const before = JSON.stringify(inputs);
    const readProduct = vi.fn().mockResolvedValue({
      priceIds: ["price-monthly"],
      meterIds: [],
    });

    await expect(inspectPolarContractMappingDrift(inputs, { readProduct })).resolves.toEqual([
      {
        planVersionRef: "pro@1",
        productId: "product-pro",
        missingPriceIds: ["price-overage"],
        missingMeterIds: ["meter-api"],
      },
    ]);
    expect(readProduct).toHaveBeenCalledExactlyOnceWith("product-pro");
    expect(JSON.stringify(inputs)).toBe(before);
  });
});
