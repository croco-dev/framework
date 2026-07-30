import { describe, expect, it, vi } from "vitest";

import { widenMeteringIntegersPostgres } from "../migrations/widenMeteringIntegers";

describe("widenMeteringIntegersPostgres", () => {
  it("widens PostgreSQL usage and quota columns to BIGINT", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);

    await widenMeteringIntegersPostgres({ execute });

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
