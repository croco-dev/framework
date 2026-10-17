import { describe, expect, it, vi } from "vitest";
import { AcquisitionProblem } from "@croco/analytics-core/acquisition";
import type { AcquisitionService } from "@croco/analytics-core/acquisition";
import { createAcquisitionOperations } from "../libs/AcquisitionOperations";
const scope = { app: "shop", environment: "test", tenantId: "one" };
const query = {
  conversion: {
    ref: "conversion",
    identity: { kind: "subject" as const, ref: "user" },
    occurredAt: "2026-10-17T12:00:00.000Z",
  },
  definitions: [{ id: "first", revision: 1 }],
  limit: 10,
};
describe("acquisition operations", () => {
  it("binds the server scope and preserves a failed lookup as failure rather than empty evidence", async () => {
    const compare = vi.fn().mockResolvedValue({ touchpoints: [], declarations: [] });
    const operations = createAcquisitionOperations(
      { compare } as unknown as AcquisitionService,
      scope,
    );
    expect(
      await operations.compare({ ...query, scope: { ...scope, tenantId: "evil" } } as never),
    ).toEqual({ kind: "empty" });
    expect(compare).toHaveBeenCalledWith({ ...query, scope });
    compare.mockRejectedValue(new AcquisitionProblem("persistence"));
    await expect(operations.compare(query)).rejects.toMatchObject({
      code: "analytics/acquisition/persistence",
    });
  });
  it.each([
    ["denied", "denied"],
    ["limit", "partial"],
  ] as const)("renders %s without calculation results", async (failure, kind) => {
    const operations = createAcquisitionOperations(
      {
        compare: async () => {
          throw new AcquisitionProblem(failure);
        },
      } as unknown as AcquisitionService,
      scope,
    );
    expect(await operations.compare(query)).toEqual({ kind });
  });
});
